# Sprite generation prompts — the 14 remaining species

Hand this file to the **local** Claude Code (the one connected to ComfyUI). It
has the style template, per-species descriptions, and a ready-to-run batch
instruction. Stages per species: **baby → child → teen → adult** (no `ascended`
— that's only dragon/unicorn).

## Prompt assembly

Build each **positive** prompt as:

```
pixel art, <STAGE>, <SUBJECT>, full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs
```

- **Background / cutout:** render on the model's default flat backdrop (it
  ignores chroma-key requests at CFG 1.5 and just tints the creature). The
  cutout is handled by an improved edge flood-fill in `sprite-lib.mjs` that
  samples the actual corner background colour, so even low-contrast subjects
  (purple bat, grey elephant) cut cleanly with the default tolerance. No
  per-species tuning needed in the normal case.
- The **negative** prompt is already baked into the workflow (node 7) — only
  override the positive `text` when enqueuing.
- Use the **same seed for all four stages of a species** so it reads as the same
  character growing up; use a **different seed per species**. Suggested seeds are
  in the table.

### STAGE modifiers
| Stage | Modifier |
|-------|----------|
| baby  | `newborn baby, tiny chibi body, big round head, oversized eyes, soft and round, adorable` |
| child | `young, small body, slightly longer limbs, playful, cute proportions` |
| teen  | `adolescent, taller and lankier, lean, growing into adult features` |
| adult | `fully grown adult, strong confident stance, full detailed markings, majestic` |

### SUBJECT per species
| slug | emoji | seed | SUBJECT |
|------|-------|------|---------|
| fox | 🦊 | 12 | `side profile view of a fox standing on all fours, orange fur, white belly, white-tipped bushy tail, pointed ears` |
| bat | 🦇 | 22 | `a bat, purple-grey fur, big membrane wings, large ears, tiny fangs` |
| penguin | 🐧 | 33 | `a penguin, black back, white belly, orange beak and feet` |
| sloth | 🦥 | 44 | `a sloth, shaggy brown fur, long arms, dark eye patches, sleepy smile` |
| owl | 🦉 | 55 | `an owl, round body, brown and cream feathers, huge eyes, feather tufts` |
| eagle | 🦅 | 66 | `a bald eagle, brown body, white feathered head, hooked yellow beak` |
| kangaroo | 🦘 | 77 | `a kangaroo, tan fur, large hind legs, long thick tail, small arms` |
| giraffe | 🦒 | 88 | `a giraffe, yellow coat with brown patches, long neck, small ossicone horns` |
| tiger | 🐅 | 99 | `a tiger, orange fur, bold black stripes, white belly` |
| elephant | 🐘 | 111 | `an elephant, grey skin, long trunk, large ears (small tusks if adult)` |
| crocodile | 🐊 | 222 | `a single crocodile, green scaly body, long snout, visible teeth, ridged back, lying low on the ground on four legs` (needs custom suffix — see note) |
| octopus | 🐙 | 233 | `a cute cartoon octopus, bright vivid purple skin, eight curling tentacles, big round eyes` (custom suffix; colour still reads grey/blue, not purple) |
| trex | 🦖 | 144 | `a tyrannosaurus rex dinosaur, green scaly body, big head and jaws, tiny arms, thick tail` — reworked at seed 244 with `standing on two legs` + full-body suffix |
| merperson | 🧜 | 155 | `a merperson, human upper body, shimmering teal fish tail, flowing hair` |

### Worked example — fox (all four stages)
```
pixel art, newborn baby, tiny chibi body, big round head, oversized eyes, soft and round, adorable, side profile view of a fox standing on all fours, orange fur, white belly, white-tipped bushy tail, pointed ears, full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs
pixel art, young, small body, slightly longer limbs, playful, cute proportions, side profile view of a fox standing on all fours, orange fur, white belly, white-tipped bushy tail, pointed ears, full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs
pixel art, adolescent, taller and lankier, lean, growing into adult features, side profile view of a fox standing on all fours, orange fur, white belly, white-tipped bushy tail, pointed ears, full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs
pixel art, fully grown adult, strong confident stance, full detailed markings, majestic, side profile view of a fox standing on all fours, orange fur, white belly, white-tipped bushy tail, pointed ears, full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs
```

## Batch instruction (paste into local Claude Code)

> For each species in `scripts/comfyui/prompts.md` and each stage (baby, child,
> teen, adult), assemble the positive prompt as `pixel art, <STAGE modifier>,
> <SUBJECT>, side profile, full body, centered, simple flat solid background,
> crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by
> nerijs`. Use the species' seed for all its stages.
>
> For each one: enqueue `scripts/comfyui/pixelpet-sdxl-lora.json` via the comfyui
> MCP (override the positive `text` and `seed`), wait for completion, then run
> `npm run sprite -- --in "<output png>" --slug <slug> --stage <stage> --autobg --trim`,
> then `node scripts/preview-sprite.mjs assets/sprites/<slug>-<stage>.png`.
> (`--trim` crops the subject so it fills the 64×64 frame and drops stray specks.)
>
> **Start with fox/baby only and show me the preview + holes count. Wait for my
> OK before continuing the rest.** If a sprite has interior holes, retry the
> convert with `--bg-tolerance 30` (then 20); if it still has holes or looks
> wrong, regenerate with a new seed. After all four stages of a species look
> good, move to the next.

## Tips
- **Framing:** the template forces *full body, wide shot, small in frame* and the
  workflow negative blocks *close-up/portrait/face only* — so renders should show
  the whole animal, not a head. If one still comes out as a face, regenerate with
  a new seed.
- **Orientation:** the set is mixed (dog is front-on, dragon/turtle are side
  profile), so pick what reads best per animal. For a **side profile**, start the
  SUBJECT with `side profile view of a <animal> standing on all fours` (fox is
  already set up this way; good candidates: tiger, crocodile, trex, kangaroo,
  giraffe). Front-on is fine for penguin, owl, sloth, octopus, merperson.
- **Per-species framing (`gen-species.mjs --suffix`):** the default suffix
  (`small in frame, wide shot, standing`) works for most, but a few subjects need
  an override: **crocodile** scatters into multiple animals unless you force a
  single low side-profile and drop "wide shot" (`--suffix "side view, full body,
  one crocodile centered, low to the ground, ..."`); **octopus** shouldn't be
  "standing" (`--suffix "full body, entire creature visible, centered, ..."`);
  **trex** teen/adult collapse to blobs unless you say `standing on two legs` and
  drop "small in frame". Reptilian/cephalopod colours stay muted (the LoRA won't
  hold bright hues at CFG 1.5).
- **Holes** (from `preview-sprite.mjs`): lower `--bg-tolerance` (try 30, then 20).
  A thin background fringe instead: raise it (80). The converter now also
  auto-fills enclosed pinholes and despeckles, so most cutouts are clean by
  default; low-contrast subjects (grey elephant, purple bat) work because the
  flood-fill tolerance adapts to the backdrop's variance.
- **Consistency:** keep the per-species seed fixed across stages; if a stage
  drifts off-model, bump that one stage's seed until it matches.
- **Commit as you go** so finished sprites are saved:
  `git add assets/sprites src/sprites/images.ts scripts/species-map.json && git commit -m "Add <species> sprites"`.
- The pipeline only renders a PNG once it's wired; check it in the app with
  `npm install` then `npm run web`.

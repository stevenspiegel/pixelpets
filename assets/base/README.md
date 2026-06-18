# Base / Habitat decoration art

Drop one **transparent PNG per decoration** here, named to match its `id` in
[`src/state/base.ts`](../../src/state/base.ts) (`BASE_DECOR`). Until a PNG
exists for an id, the screen falls back to the emoji `glyph` defined there, so
art can land incrementally — add a file, wire it, ship it.

## Expected files

| file                      | item       | id        | footprint (default 1×1) |
| ------------------------- | ---------- | --------- | ----------------------- |
| `assets/base/wall_0.png` … `wall_15.png` | Wall (auto-tiling set, keyed by neighbour bitmask) | `fence` | 1×1 (tiles) |
| `assets/base/rock.png`    | Rock       | `rock`    | 1×1                     |
| `assets/base/bush.png`    | Bush       | `bush`    | 1×1                     |
| `assets/base/bowl.png`    | Food Bowl  | `bowl`    | 1×1                     |
| `assets/base/ball.png`    | Toy Ball   | `ball`    | 1×1                     |
| `assets/base/flowers.png` | Flowers    | `flowers` | 1×1                     |
| `assets/base/tree.png`    | Tree       | `tree`    | 1×1                     |
| `assets/base/lamp.png`    | Lamp       | `lamp`    | 1×1                     |
| `assets/base/bed.png`     | Pet Bed    | `bed`     | 1×1                     |
| `assets/base/pond.png`    | Pond       | `pond`    | 1×1                     |

## Art guidelines

- **Transparent background** (alpha PNG), so items read cleanly over any floor.
- **Square canvas**, e.g. 128×128 for a 1×1 item. A grid cell is
  `BOARD / BASE_GRID` (6×6 grid), and the sprite is drawn centered in its cell.
- Multi-cell items: size the canvas to the footprint (e.g. 256×128 for a 2×1)
  and set `w`/`h` on the `BASE_DECOR` entry to match.
- Pixel-art style consistent with the creature sprites in `assets/sprites/`.
- **Walls** (`tile: true`, id `fence`) auto-tile: the renderer computes a 4-bit
  neighbour bitmask (N=1, E=2, S=4, W=8) per wall cell and draws the matching
  `wall_<mask>.png`. The 16 sprites are generated procedurally for pixel-exact
  seamless edges — `node scripts/gen-walls.mjs` rewrites `wall_0.png` … `wall_15.png`.

## Adding a new decoration

1. Drop `<id>.png` in this folder.
2. Add a `BASE_DECOR` entry in `src/state/base.ts` (`id`, `name`, `price`,
   `glyph` fallback, optional `w`/`h`).
3. Mirror the id→price in `_decor_price` in `supabase/schema.sql` (the server is
   the source of truth for prices and the valid-id set).
4. Wire `<id> → require('../../assets/base/<id>.png')` in the decor image map.

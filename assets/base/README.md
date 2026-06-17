# Base / Habitat decoration art

Drop one **transparent PNG per decoration** here, named to match its `id` in
[`src/state/base.ts`](../../src/state/base.ts) (`BASE_DECOR`). Until a PNG
exists for an id, the screen falls back to the emoji `glyph` defined there, so
art can land incrementally — add a file, wire it, ship it.

## Expected files

| file                      | item       | id        | footprint (default 1×1) |
| ------------------------- | ---------- | --------- | ----------------------- |
| `assets/base/fence.png`   | Fence ↔    | `fence`   | 1×1 (tiles)             |
| `assets/base/fence_v.png` | Fence ↕    | `fence_v` | 1×1 (tiles)             |
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
- **Tiling items** (`tile: true` in `BASE_DECOR`, e.g. the fences) render
  edge-to-edge (full cell) instead of inset, so copies in adjacent cells touch.
  Their art must reach the exact tile edges to connect seamlessly. The fence
  pieces are generated procedurally for pixel-exact edges —
  `node scripts/gen-fence.mjs` rewrites `fence.png` (horizontal) and
  `fence_v.png` (the same fence rotated 90° for vertical runs).

## Adding a new decoration

1. Drop `<id>.png` in this folder.
2. Add a `BASE_DECOR` entry in `src/state/base.ts` (`id`, `name`, `price`,
   `glyph` fallback, optional `w`/`h`).
3. Mirror the id→price in `_decor_price` in `supabase/schema.sql` (the server is
   the source of truth for prices and the valid-id set).
4. Wire `<id> → require('../../assets/base/<id>.png')` in the decor image map.

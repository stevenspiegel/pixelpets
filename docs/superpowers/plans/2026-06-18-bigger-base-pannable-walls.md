# Bigger Pannable Base + Auto-Tiling Walls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the Base habitat to a 12×12 grid shown through a pinch-zoom/pan viewport, and replace the two manual fence pieces with a single auto-tiling wall that connects automatically.

**Architecture:** Grid size is a constant mirrored client (`src/state/base.ts`) and server (`supabase/schema.sql`). Walls become one catalog item rendered by a per-cell neighbor bitmask that selects one of 16 procedurally-generated sprites. The board content (672px) is laid out normally and shown through a fixed viewport window transformed by a composed pinch+pan gesture; cell `Pressable`s are hit-tested through the transform so taps still land correctly.

**Tech Stack:** React Native 0.74 / Expo SDK 51, TypeScript, Supabase (Postgres RPC), `react-native-gesture-handler` + `react-native-reanimated` (added in Task 4), Node PNG generation via `scripts/sprite-lib.mjs`.

## Global Constraints

- Grid size MUST stay in sync between `BASE_GRID` (`src/state/base.ts`) and `_base_grid()` (`supabase/schema.sql`). Target value: `12`.
- Placement cap MUST stay in sync between `BASE_MAX_ITEMS` and `_base_max_items()`. Target value: `120`.
- No unit-test runner exists. Verification per task = `npm run typecheck` (must pass clean) plus a visual check in the web preview harness (`npm run preview:base`, opened at `http://localhost:8081/?preview=base`). Drive/screenshot the preview to confirm behavior.
- All decoration/wall art is custom-generated (no third-party art), consistent with the existing `gen-fence.mjs` procedural approach.
- Server keeps both `fence` and `fence_v` valid in `_decor_price` (price 20) for backward compatibility; the client writes only `fence` going forward.
- Wall id strategy: keep id `fence` as the single wall item; `fence_v` is normalized to `fence` on load. The renderer treats `id === 'fence'` as a wall.
- Reanimated's Babel plugin MUST be listed last in `babel.config.js`.

---

### Task 1: Enlarge grid + placement cap (client + server constants)

**Files:**
- Modify: `src/state/base.ts:8-9`
- Modify: `supabase/schema.sql:453-456`

**Interfaces:**
- Consumes: nothing.
- Produces: `BASE_GRID = 12`, `BASE_MAX_ITEMS = 120` (both exported from `src/state/base.ts`, already imported by `BaseScreen.tsx`). Server functions `_base_grid()` → 12 and `_base_max_items()` → 120.

- [ ] **Step 1: Bump the client grid constants**

In `src/state/base.ts`, change:

```ts
export const BASE_GRID = 6; // 6x6
export const BASE_MAX_ITEMS = 40;
```

to:

```ts
export const BASE_GRID = 12; // 12x12 (shown through a pan/zoom viewport)
export const BASE_MAX_ITEMS = 120; // anti-abuse cap, generous on the 144-cell board
```

- [ ] **Step 2: Bump the server grid constants to match**

In `supabase/schema.sql`, change the two mirror functions:

```sql
create or replace function public._base_grid() returns integer
  language sql immutable as $$ select 6 $$;        -- 6x6 grid
create or replace function public._base_max_items() returns integer
  language sql immutable as $$ select 40 $$;       -- anti-abuse cap on placements
```

to:

```sql
create or replace function public._base_grid() returns integer
  language sql immutable as $$ select 12 $$;       -- 12x12 grid (pan/zoom viewport)
create or replace function public._base_max_items() returns integer
  language sql immutable as $$ select 120 $$;      -- anti-abuse cap on placements
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no output, exit 0).

- [ ] **Step 4: Visual check in preview**

Run: `npm run preview:base` (leave running), open `http://localhost:8081/?preview=base`.
Expected: the board now shows a 12×12 grid (cells are small at this stage — sizing/zoom comes in Task 4); the seeded decorations and the mine/vault still appear in their original corner, in-bounds. Stop the server when done.

- [ ] **Step 5: Commit**

```bash
git add src/state/base.ts supabase/schema.sql
git commit -m "feat(base): enlarge habitat grid to 12x12, raise placement cap to 120"
```

---

### Task 2: Generate auto-tiling wall sprites

**Files:**
- Create: `scripts/gen-walls.mjs`
- Delete: `scripts/gen-fence.mjs` (replaced)
- Create (generated): `assets/base/wall_0.png` … `assets/base/wall_15.png`
- Delete: `assets/base/fence.png`, `assets/base/fence_v.png`
- Modify: `assets/base/README.md`

**Interfaces:**
- Consumes: `encodePng(width, height, Uint8Array)` from `scripts/sprite-lib.mjs` (already used by `gen-fence.mjs`).
- Produces: 16 transparent 64×64 PNGs named `wall_<mask>.png`, where `<mask>` is the 4-bit neighbor bitmask `N=1, E=2, S=4, W=8`. Each set bit means a rail arm reaches that edge; bit 0 (no neighbors) is a lone center post.

- [ ] **Step 1: Write the generator script**

Create `scripts/gen-walls.mjs`:

```js
// Generate the habitat WALL art procedurally as a 16-tile auto-tiling set.
//
// Each tile is keyed by a 4-bit neighbor bitmask (N=1, E=2, S=4, W=8): a set bit
// means the adjacent cell is also a wall, so this tile draws a rail "arm" reaching
// that edge. A center post hub ties the arms together, so any straight run, corner,
// T-junction, cross, or end-cap is composed from the same primitives and connects
// seamlessly with neighbours (opposing arms meet at the shared edge with identical
// rail offsets). Mask 0 (no neighbours) is a lone post.
//
// Hand-drawn (not AI-generated) because seamless tiling needs rails to hit the exact
// pixel edges. Outputs assets/base/wall_0.png .. wall_15.png.
//
// Usage: node scripts/gen-walls.mjs
import fs from 'fs';
import path from 'path';
import url from 'url';
import { encodePng } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const S = 64;

// Warm wood palette (outline → highlight), matching the old fence art.
const OUT = [0x4a, 0x2f, 0x18, 255];
const DARK = [0x6b, 0x45, 0x23, 255];
const MID = [0x9c, 0x6b, 0x3f, 255];
const LIGHT = [0xc1, 0x90, 0x57, 255];

// Two rail spans, symmetric around the 32px centre, used for both axes so corners
// line up. Centre post hub bounds.
const RA = [20, 26]; // first rail span
const RB = [38, 44]; // second rail span
const POST = [24, 40]; // centre hub bounds (inclusive)

const mk = () => new Uint8Array(S * S * 4); // fully transparent
const set = (buf, x, y, c) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const o = (y * S + x) * 4;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = c[3];
};
const rect = (buf, x0, y0, x1, y1, c) => {
  for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) set(buf, x, y, c);
};

// Horizontal rail bar across [x0,x1] at row span [r0,r1], shaded top→bottom.
const hRail = (buf, x0, x1, r0, r1) => {
  rect(buf, x0, r0, x1, r1, MID);
  rect(buf, x0, r0, x1, r0, LIGHT); // top highlight
  rect(buf, x0, r1 - 1, x1, r1 - 1, DARK);
  rect(buf, x0, r1, x1, r1, OUT); // bottom shadow
};
// Vertical rail bar down [y0,y1] at col span [c0,c1], shaded left→right.
const vRail = (buf, y0, y1, c0, c1) => {
  rect(buf, c0, y0, c1, y1, MID);
  rect(buf, c0, y0, c0, y1, LIGHT); // left highlight
  rect(buf, c1 - 1, y0, c1 - 1, y1, DARK);
  rect(buf, c1, y0, c1, y1, OUT); // right shadow
};

const drawWall = (mask) => {
  const buf = mk();
  const N = mask & 1, E = mask & 2, Sb = mask & 4, W = mask & 8;
  // Arms reach the exact edge so neighbouring tiles connect seamlessly.
  if (E) { hRail(buf, 32, S - 1, RA[0], RA[1]); hRail(buf, 32, S - 1, RB[0], RB[1]); }
  if (W) { hRail(buf, 0, 32, RA[0], RA[1]); hRail(buf, 0, 32, RB[0], RB[1]); }
  if (N) { vRail(buf, 0, 32, RA[0], RA[1]); vRail(buf, 0, 32, RB[0], RB[1]); }
  if (Sb) { vRail(buf, 32, S - 1, RA[0], RA[1]); vRail(buf, 32, S - 1, RB[0], RB[1]); }
  // Centre post hub, drawn last so all arms tie into it cleanly.
  rect(buf, POST[0], POST[0], POST[1], POST[1], MID);
  rect(buf, POST[0], POST[0], POST[1], POST[0], LIGHT); // top highlight
  rect(buf, POST[0], POST[0], POST[0], POST[1], LIGHT); // left highlight
  rect(buf, POST[1], POST[0], POST[1], POST[1], OUT);   // right outline
  rect(buf, POST[0], POST[1], POST[1], POST[1], OUT);   // bottom outline
  return buf;
};

for (let mask = 0; mask < 16; mask++) {
  fs.writeFileSync(path.join(root, `assets/base/wall_${mask}.png`), encodePng(S, S, drawWall(mask)));
}
console.log('Wrote assets/base/wall_0.png .. wall_15.png (64x64, auto-tiling).');
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/gen-walls.mjs`
Expected: prints `Wrote assets/base/wall_0.png .. wall_15.png (64x64, auto-tiling).`

- [ ] **Step 3: Verify the 16 files exist**

Run: `ls assets/base/wall_*.png | wc -l`
Expected: `16`

- [ ] **Step 4: Remove the obsolete fence generator and art**

```bash
git rm scripts/gen-fence.mjs assets/base/fence.png assets/base/fence_v.png
```

- [ ] **Step 5: Update the art README**

In `assets/base/README.md`, replace the two fence rows in the "Expected files" table:

```
| `assets/base/fence.png`   | Fence ↔    | `fence`   | 1×1 (tiles)             |
| `assets/base/fence_v.png` | Fence ↕    | `fence_v` | 1×1 (tiles)             |
```

with a single wall row:

```
| `assets/base/wall_0.png` … `wall_15.png` | Wall (auto-tiling set, keyed by neighbour bitmask) | `fence` | 1×1 (tiles) |
```

Then replace the "Tiling items" bullet at the bottom that references `gen-fence.mjs`:

```
- **Tiling items** (`tile: true` in `BASE_DECOR`, e.g. the fences) render
  edge-to-edge (full cell) instead of inset, so copies in adjacent cells touch.
  Their art must reach the exact tile edges to connect seamlessly. The fence
  pieces are generated procedurally for pixel-exact edges —
  `node scripts/gen-fence.mjs` rewrites `fence.png` (horizontal) and
  `fence_v.png` (the same fence rotated 90° for vertical runs).
```

with:

```
- **Walls** (`tile: true`, id `fence`) auto-tile: the renderer computes a 4-bit
  neighbour bitmask (N=1, E=2, S=4, W=8) per wall cell and draws the matching
  `wall_<mask>.png`. The 16 sprites are generated procedurally for pixel-exact
  seamless edges — `node scripts/gen-walls.mjs` rewrites `wall_0.png` … `wall_15.png`.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-walls.mjs assets/base/wall_*.png assets/base/README.md
git commit -m "feat(base): generate 16-tile auto-tiling wall sprite set"
```

---

### Task 3: Auto-tiling wall rendering (catalog, mask, images, migration)

**Files:**
- Modify: `src/state/base.ts` (catalog entries ~27-28; `fetchBase` ~183-191; add helpers)
- Modify: `src/base/images.ts` (drop fence entries from `DECOR_ART`; add `WALL_ART` + `wallArt`)
- Modify: `src/components/BaseScreen.tsx` (imports; `wallSet`; cell render branch)
- Modify: `src/dev/BasePreview.tsx` (sample layout → wall loop)

**Interfaces:**
- Consumes: `wallArt(mask: number): ImageSourcePropType | undefined` (Task 2 sprites, wired here); `BASE_GRID`, `BASE_MAX_ITEMS` (Task 1).
- Produces:
  - `isWall(id: string): boolean` — true when the placement is a wall (`id === 'fence'`).
  - `wallMask(walls: Set<string>, x: number, y: number): number` — 4-bit neighbor mask (N=1, E=2, S=4, W=8) over a set of `"x,y"` wall-coord strings.
  - `normalizeLayout(raw: Placed[]): Placed[]` — maps any `fence_v` placement to `fence`.
  - One wall catalog entry in `BASE_DECOR` with `id: 'fence'`, `name: 'Wall'`.

- [ ] **Step 1: Replace the two fence catalog entries with one wall entry**

In `src/state/base.ts`, change:

```ts
  { id: 'fence', name: 'Fence ↔', price: 20, glyph: '🪵', tile: true },
  { id: 'fence_v', name: 'Fence ↕', price: 20, glyph: '🪵', tile: true },
```

to:

```ts
  { id: 'fence', name: 'Wall', price: 20, glyph: '🧱', tile: true },
```

- [ ] **Step 2: Add the wall + layout helpers**

In `src/state/base.ts`, add after the `decorById` / `floorColor` helpers (after `base.ts:51`):

```ts
// Walls auto-tile: a single catalog item (id 'fence') whose rendered sprite is
// chosen from its neighbours. fence_v is a legacy id normalized to 'fence' on load.
export const isWall = (id: string): boolean => id === 'fence';

// 4-bit neighbour bitmask for the wall at (x,y): N=1, E=2, S=4, W=8. `walls` is a
// set of "x,y" coord strings for every wall cell currently on the board.
export const wallMask = (walls: Set<string>, x: number, y: number): number =>
  (walls.has(`${x},${y - 1}`) ? 1 : 0) |
  (walls.has(`${x + 1},${y}`) ? 2 : 0) |
  (walls.has(`${x},${y + 1}`) ? 4 : 0) |
  (walls.has(`${x - 1},${y}`) ? 8 : 0);

// Migrate legacy vertical fences to the unified wall id so old bases auto-tile.
export const normalizeLayout = (raw: Placed[]): Placed[] =>
  raw.map((p) => (p.id === 'fence_v' ? { ...p, id: 'fence' } : p));
```

(`Placed` is declared later in the file at `base.ts:148`; TypeScript type references hoist, so this compiles.)

- [ ] **Step 3: Normalize the layout in `fetchBase`**

In `src/state/base.ts` `fetchBase`, change:

```ts
    layout: (d.base_layout as Placed[]) ?? [],
```

to:

```ts
    layout: normalizeLayout((d.base_layout as Placed[]) ?? []),
```

- [ ] **Step 4: Wire the wall sprites in `images.ts`**

In `src/base/images.ts`, remove the two fence entries from `DECOR_ART`:

```ts
  fence: require('../../assets/base/fence.png'),
  fence_v: require('../../assets/base/fence_v.png'),
```

Then add, after the `decorArt` accessor (after `images.ts:23`):

```ts
// Auto-tiling wall sprites, keyed by neighbour bitmask (see wallMask in
// src/state/base.ts). Generated by scripts/gen-walls.mjs.
export const WALL_ART: Record<number, ImageSourcePropType> = {
  0: require('../../assets/base/wall_0.png'),
  1: require('../../assets/base/wall_1.png'),
  2: require('../../assets/base/wall_2.png'),
  3: require('../../assets/base/wall_3.png'),
  4: require('../../assets/base/wall_4.png'),
  5: require('../../assets/base/wall_5.png'),
  6: require('../../assets/base/wall_6.png'),
  7: require('../../assets/base/wall_7.png'),
  8: require('../../assets/base/wall_8.png'),
  9: require('../../assets/base/wall_9.png'),
  10: require('../../assets/base/wall_10.png'),
  11: require('../../assets/base/wall_11.png'),
  12: require('../../assets/base/wall_12.png'),
  13: require('../../assets/base/wall_13.png'),
  14: require('../../assets/base/wall_14.png'),
  15: require('../../assets/base/wall_15.png'),
};

export const wallArt = (mask: number): ImageSourcePropType | undefined =>
  WALL_ART[mask];
```

- [ ] **Step 5: Render walls by mask in `BaseScreen`**

In `src/components/BaseScreen.tsx`, add to the imports from `'../base/images'` (currently `import { decorArt, buildingArt } from '../base/images';`):

```ts
import { decorArt, buildingArt, wallArt } from '../base/images';
```

Add to the imports from `'../state/base'` (the destructured block at `base.ts:13-36`): `isWall,` and `wallMask,`.

In the component body, after `const placedAt = ...` (`BaseScreen.tsx:263`), add:

```ts
  // Coords of every wall cell, for O(1) neighbour lookup when auto-tiling.
  const wallSet = new Set(
    layout.filter((p) => isWall(p.id)).map((p) => `${p.x},${p.y}`)
  );
```

Then in the cell render, change:

```tsx
                  const here = placedAt(x, y);
                  const tile = here ? decorById(here.id)?.tile : false;
                  return (
                    <Pressable
                      key={x}
                      onPress={() => onCell(x, y)}
                      style={[styles.cell, editing && styles.cellEditing]}
                    >
                      {here && <DecorIcon id={here.id} size={tile ? CELL : CELL * 0.78} bleed={tile} />}
                    </Pressable>
                  );
```

to:

```tsx
                  const here = placedAt(x, y);
                  const wall = here ? isWall(here.id) : false;
                  const tile = here ? decorById(here.id)?.tile : false;
                  const wallSrc = wall ? wallArt(wallMask(wallSet, x, y)) : undefined;
                  return (
                    <Pressable
                      key={x}
                      onPress={() => onCell(x, y)}
                      style={[styles.cell, editing && styles.cellEditing]}
                    >
                      {wall && wallSrc ? (
                        <Image source={wallSrc} style={{ width: CELL, height: CELL }} resizeMode="cover" />
                      ) : (
                        here && <DecorIcon id={here.id} size={tile ? CELL : CELL * 0.78} bleed={tile} />
                      )}
                    </Pressable>
                  );
```

(`Image` is already imported in `BaseScreen.tsx:9`.)

- [ ] **Step 6: Update the dev preview to show an auto-connecting wall loop**

In `src/dev/BasePreview.tsx`, replace the fence rows in the `layout` array:

```ts
    { id: 'fence', x: 0, y: 0 }, { id: 'fence', x: 1, y: 0 }, { id: 'fence', x: 2, y: 0 },
    { id: 'fence', x: 3, y: 0 }, { id: 'fence', x: 4, y: 0 }, { id: 'fence', x: 5, y: 0 },
    { id: 'fence_v', x: 0, y: 1 }, { id: 'fence_v', x: 0, y: 2 }, { id: 'fence_v', x: 0, y: 3 },
    { id: 'fence_v', x: 0, y: 4 }, { id: 'fence_v', x: 0, y: 5 },
```

with a closed rectangular wall loop (exercises corners, straights, and the cross/T cases):

```ts
    // Closed wall loop: corners at (0,0)/(5,0)/(0,5)/(5,5), straights between.
    { id: 'fence', x: 0, y: 0 }, { id: 'fence', x: 1, y: 0 }, { id: 'fence', x: 2, y: 0 },
    { id: 'fence', x: 3, y: 0 }, { id: 'fence', x: 4, y: 0 }, { id: 'fence', x: 5, y: 0 },
    { id: 'fence', x: 0, y: 5 }, { id: 'fence', x: 1, y: 5 }, { id: 'fence', x: 2, y: 5 },
    { id: 'fence', x: 3, y: 5 }, { id: 'fence', x: 4, y: 5 }, { id: 'fence', x: 5, y: 5 },
    { id: 'fence', x: 0, y: 1 }, { id: 'fence', x: 0, y: 2 }, { id: 'fence', x: 0, y: 3 }, { id: 'fence', x: 0, y: 4 },
    { id: 'fence', x: 5, y: 1 }, { id: 'fence', x: 5, y: 2 }, { id: 'fence', x: 5, y: 3 }, { id: 'fence', x: 5, y: 4 },
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If it reports `fence`/`fence_v` art still referenced, ensure Step 4 removed both `DECOR_ART` lines.)

- [ ] **Step 8: Visual check in preview**

Run: `npm run preview:base`, open `http://localhost:8081/?preview=base`.
Expected: the wall loop renders as a **continuous rectangle** — the four corners are L-joints, the top/bottom/sides are straight runs, with no gaps where vertical meets horizontal. Tapping EDIT BASE → selecting Wall → tapping adjacent empty cells extends the wall and the sprites re-tile to connect. Stop the server when done.

- [ ] **Step 9: Commit**

```bash
git add src/state/base.ts src/base/images.ts src/components/BaseScreen.tsx src/dev/BasePreview.tsx
git commit -m "feat(base): auto-tiling walls replace manual fence pieces"
```

---

### Task 4: Pinch-zoom + pan viewport

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `babel.config.js`
- Modify: `App.tsx` (root wrapper)
- Modify: `src/components/BaseScreen.tsx` (CELL/BOARD sizing, viewport + gesture wrapper)

**Interfaces:**
- Consumes: `BASE_GRID` (Task 1); the existing board JSX (rows + absolute pet/building overlays) from `BaseScreen`.
- Produces: a `<GestureHandlerRootView>` app root; a zoom/pan viewport in `BaseScreen` wrapping the unchanged board content.

- [ ] **Step 1: Install the gesture + animation libraries**

Run: `npx expo install react-native-gesture-handler react-native-reanimated`
Expected: both added to `package.json` dependencies at Expo-SDK-51-compatible versions; install completes without peer-dependency errors.

- [ ] **Step 2: Add the reanimated Babel plugin (must be last)**

Change `babel.config.js` from:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

to:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // must be listed last
  };
};
```

- [ ] **Step 3: Wrap the app root in GestureHandlerRootView**

In `App.tsx`, add the import (after `App.tsx:10`):

```ts
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

Change the top of the returned JSX from:

```tsx
  return (
    <View style={styles.root}>
```

to:

```tsx
  return (
    <GestureHandlerRootView style={styles.root}>
```

and the matching closing tag from:

```tsx
    </View>
  );
}
```

to:

```tsx
    </GestureHandlerRootView>
  );
}
```

(The inner `<View style={styles.grass}>` / `<View style={styles.overlay}>` structure is unchanged; only the outermost wrapper swaps.)

- [ ] **Step 4: Switch BaseScreen to fixed cell size + content board**

In `src/components/BaseScreen.tsx`, change the sizing constants (`BaseScreen.tsx:51-52`):

```ts
// Cell size for the rendered grid (square board, scaled to fit ~340px).
const BOARD = 336;
const CELL = BOARD / BASE_GRID;
```

to:

```ts
// Cells stay full size; the board content is BASE_GRID*CELL and is shown through
// a fixed VIEWPORT window the player pinch-zooms and pans.
const CELL = 56;
const BOARD = CELL * BASE_GRID; // 12 * 56 = 672 content px
const VIEWPORT = 336;           // visible window
const MIN_SCALE = VIEWPORT / BOARD; // fit whole board in the window (~0.5)
const MAX_SCALE = 1.5;
```

- [ ] **Step 5: Add the gesture imports to BaseScreen**

In `src/components/BaseScreen.tsx`, add after the existing imports:

```ts
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
```

- [ ] **Step 6: Add zoom/pan shared values + gesture inside the component**

In `src/components/BaseScreen.tsx`, add inside the component body (e.g. after the `now`/interval hooks, before `livePets`):

```ts
  // Pinch-zoom + pan transform for the board within the VIEWPORT window.
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Keep the board edges from panning inside the viewport at the current scale.
  const clamp = (v: number, s: number) => {
    'worklet';
    const overflow = Math.max(0, (BOARD * s - VIEWPORT) / 2);
    return Math.min(overflow, Math.max(-overflow, v));
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = clamp(savedTx.value + e.translationX, scale.value);
      ty.value = clamp(savedTy.value + e.translationY, scale.value);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      scale.value = s;
      tx.value = clamp(tx.value, s);
      ty.value = clamp(ty.value, s);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const boardGesture = Gesture.Simultaneous(pan, pinch);

  const boardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));
```

- [ ] **Step 7: Wrap the board content in the viewport + gesture**

In `src/components/BaseScreen.tsx`, the board currently begins:

```tsx
          {/* The board: floor + grid cells with decor; pets overlaid on top. */}
          <View style={[styles.board, { backgroundColor: floorColor(floor) }]}>
```

and ends with the closing `</View>` after the unplaced-pets block (`BaseScreen.tsx:352`). Wrap that whole `<View style={styles.board}> … </View>` in a viewport + `GestureDetector` + `Animated.View`:

```tsx
          {/* Pinch-zoom / pan viewport. The board content is BOARD px; the window
              is VIEWPORT px and clips. Taps on cells hit-test through the transform. */}
          <View style={styles.viewport}>
            <GestureDetector gesture={boardGesture}>
              <Animated.View style={boardAnimStyle}>
                <View style={[styles.board, { backgroundColor: floorColor(floor) }]}>
                  {/* …existing rows + pet/building/unplaced-pet overlays UNCHANGED… */}
                </View>
              </Animated.View>
            </GestureDetector>
          </View>
```

Move the existing board children verbatim inside the inner `<View style={styles.board}>`. Do not change cell/pet/building markup.

- [ ] **Step 8: Add the viewport style**

In `src/components/BaseScreen.tsx` `StyleSheet.create`, add a `viewport` entry (the `board` entry keeps its `width: BOARD, height: BOARD` — now 672):

```ts
  viewport: {
    width: VIEWPORT,
    height: VIEWPORT,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: '#0d0620',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
```

And in the existing `board` style, remove the now-duplicated `borderRadius`/`borderWidth`/`borderColor` (the viewport owns the frame); keep `width: BOARD, height: BOARD, overflow: 'hidden', position: 'relative'`.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Visual check — render, pan, and tap accuracy**

Run: `npm run preview:base`, open `http://localhost:8081/?preview=base`.
Expected:
- The board shows inside a ~340px framed window with the whole 12×12 grid fit-to-view at the default (min) scale.
- Dragging pans the board within the window; it cannot be dragged past its edges.
- Tap EDIT BASE, pick the Wall item, and tap an empty cell: the wall lands on **the cell under the tap** (not offset) at the default scale. (On web, pinch isn't testable with a mouse; pan + tap accuracy are the gates here. Verify pinch on a device/emulator if available.)
- The mine's 💰 collect tap still works in view mode.
Stop the server when done.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json babel.config.js App.tsx src/components/BaseScreen.tsx
git commit -m "feat(base): pinch-zoom + pan viewport for the 12x12 board"
```

---

## Self-Review

**Spec coverage:**
- 12×12 grid + max-items 120 (client+server) → Task 1. ✓
- Pinch-zoom + pan, deps, babel plugin, GestureHandlerRootView, tap coexistence → Task 4. ✓
- Backward-compat (existing placements in-bounds) → Task 1 Step 4 check; no migration needed. ✓
- Single auto-tiling wall, neighbor bitmask, 16 sprites, full-bleed render → Tasks 2 & 3. ✓
- `fence_v` → `fence` load normalization; server keeps both priced → Task 3 Steps 2-3 (server already prices both; unchanged). ✓
- Files touched list (base.ts, BaseScreen.tsx, images.ts, App.tsx, babel.config.js, schema.sql, gen-walls.mjs, assets, README, BasePreview) → all assigned. ✓
- Testing via typecheck + preview → every task. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; no "handle edge cases" hand-waves. ✓

**Type consistency:** `isWall(id)`, `wallMask(walls, x, y)`, `normalizeLayout(raw)`, `wallArt(mask)` defined in Tasks 2-3 and consumed with matching signatures in `BaseScreen` (Task 3 Step 5). `CELL`/`BOARD`/`VIEWPORT`/`MIN_SCALE`/`MAX_SCALE` defined in Task 4 Step 4 and used in Steps 6-8. Shared-value names (`scale`/`savedScale`/`tx`/`ty`/`savedTx`/`savedTy`) consistent between Steps 6 and the animated style. ✓

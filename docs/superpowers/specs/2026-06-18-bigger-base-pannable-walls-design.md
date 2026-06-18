# Bigger pannable base + auto-tiling walls — Design

Date: 2026-06-18
Status: Approved (pending spec review)

## Problem

The Base / Habitat screen uses a fixed 6×6 grid (36 cells) rendered as a static
336px square. Players want (a) more room to place decorations and buildings, and
(b) a board that reads larger on screen. Separately, the two fence pieces
(`fence` horizontal, `fence_v` vertical) are independent straight sprites with no
corner art, so where a vertical run meets a horizontal run the rails don't join —
fences look broken at every turn.

## Goals

1. Enlarge the buildable grid to **12×12** (144 cells) while keeping cells full
   size (~56px), shown through a zoom/pan viewport.
2. Add **pinch-to-zoom + drag-to-pan** so the larger board stays usable on a
   phone screen.
3. Replace the manual horizontal/vertical fences with a single **auto-tiling
   wall** that connects automatically (the Clash-of-Clans place-and-snap feel,
   minus combat — PixelPets' base has no attackers, so only the connect behavior
   is taken).

## Non-goals (YAGNI)

- Upgradeable / multiple wall skins (wood → stone → hedge). Deferred; the wall id
  strategy below leaves room to add tiers later.
- Any defensive/combat function for walls (no attackers exist).
- Pinch-zoom on the per-decoration level; zoom applies to the whole board.

## Design

### 1. Bigger board (12×12)

Grid size is mirrored in two places that MUST stay in sync:

- Client: `BASE_GRID` `6 → 12` (`src/state/base.ts:8`).
- Server: `_base_grid()` `6 → 12` (`supabase/schema.sql:453`).

Placement cap, also mirrored, raised so a 12×12 board is usable:

- Client: `BASE_MAX_ITEMS` `40 → 120` (`src/state/base.ts:9`).
- Server: `_base_max_items()` `40 → 120` (`supabase/schema.sql:456`).

120 is generous (a player can build substantial wall runs) while still capping
abuse below the 144-cell ceiling.

Cells stay ~56px, so board *content* size becomes 12 × 56 = **672×672px**. It is
rendered inside a fixed ~340px-square **viewport window** (clamped to available
screen width) that the player zooms and pans.

**Backward compatibility:** every existing placement sits within 6×6, a subset of
12×12, so all current bases load unchanged and in-bounds. No data migration
needed for grid size.

### 2. Pinch-zoom + pan

Dependencies (installed via `npx expo install`, both supported on Expo SDK 51 and
running in Expo Go + web with no manual native rebuild):

- `react-native-gesture-handler`
- `react-native-reanimated`

Setup:

- Add the reanimated Babel plugin **last** in `babel.config.js`.
- Wrap the app root in `<GestureHandlerRootView style={{flex:1}}>` (`App.tsx`).

Interaction:

- The board is an `Animated.View` driven by a composed **pinch (scale) + pan
  (translate)** gesture (`Gesture.Simultaneous`).
- Scale clamped from fit-to-width (≈0.5×, so the whole 672px board fits the ~340px
  window) up to ~2×. Translation clamped so the board cannot be panned past its
  edges at the current scale.
- **Taps coexist with gestures:** cell `Pressable`s live in the board's
  untransformed layout. RN hit-tests children through the parent transform, so a
  tap lands on the correct cell at any scale/offset — no manual coordinate math.
  Pan only activates past a movement threshold, so a stationary tap (place /
  collect / erase) is not swallowed. The board pan gesture claims priority over
  the page-level `ScrollView` while the touch is inside the board.

**Primary risk:** gesture/`Pressable` coexistence and tap accuracy when zoomed.
Mitigation: explicit manual test (below) at default and zoomed scales.

### 3. Auto-tiling walls

Catalog:

- Collapse the two fence entries into **one wall item**: keep id `fence`, rename
  `name` to "Wall", set glyph 🧱, keep `tile: true`, price 20. Remove the
  `fence_v` entry from the client catalog/palette (`BASE_DECOR` in
  `src/state/base.ts`).

Rendering (in `BaseScreen`):

- Build a `Set` of `"x,y"` strings for all wall cells in the current `layout`.
- For each wall cell compute a 4-bit **neighbor mask**: `N=1, E=2, S=4, W=8`,
  setting a bit when the adjacent cell is also a wall.
- Map mask → sprite shape: 0 = single post; one bit = end-cap; two opposite bits
  = straight; two adjacent bits = corner; three bits = T-junction; four bits =
  cross. Render the mask's sprite full-bleed (cover), as fences render today.
- 144 cells recomputed per render is trivial; lookups are O(1) via the Set.

Sprites:

- Rewrite `scripts/gen-fence.mjs` → `scripts/gen-walls.mjs`. It generates the 6
  base shapes (single, end, straight, corner, T, cross) and rotates them (the
  existing script already does 90° rotation in JS) to emit **16 PNGs keyed by
  mask**: `assets/base/wall_0.png` … `wall_15.png`. The renderer looks up
  `wall_<mask>` directly — no runtime rotation.
- `src/base/images.ts`: add a `WALL_ART` map (mask → require) and a
  `wallArt(mask)` accessor. Keep `DECOR_ART` for non-wall decorations. Remove the
  `fence` / `fence_v` entries from `DECOR_ART` (walls render via the wall path).

Migration:

- On load (`fetchBase`, and the dev-preview seed path), normalize any `fence_v`
  placement → `fence`, so existing vertical fences become walls and auto-connect.
- Server keeps both `fence` and `fence_v` priced (20) in `_decor_price` so old
  saved layouts still validate; new `save_base_layout` writes only contain
  `fence`. No destructive server migration.
- The renderer treats `id === 'fence'` as a wall.

## Files touched

Client:
- `src/state/base.ts` — `BASE_GRID`, `BASE_MAX_ITEMS`, catalog (one wall item),
  `fence_v` → `fence` load normalization, wall-mask helper.
- `src/components/BaseScreen.tsx` — viewport window + gesture wrapper, wall
  rendering branch (mask → sprite).
- `src/base/images.ts` — `WALL_ART` map + `wallArt(mask)`; drop fence entries.
- `App.tsx` — `GestureHandlerRootView` root wrapper.
- `babel.config.js` — reanimated plugin (last).

Server:
- `supabase/schema.sql` — `_base_grid()` 12, `_base_max_items()` 120.

Art / scripts:
- `scripts/gen-walls.mjs` (rewrite of `gen-fence.mjs`) + regenerated
  `assets/base/wall_*.png`.
- `assets/base/README.md` — document the wall auto-tiling sprite set.

Dev harness:
- `src/dev/BasePreview.tsx` — update sample layout to show an auto-connecting
  wall loop on the larger grid.

## Testing

- `npm run typecheck` clean.
- Web preview (`npm run preview:base`): verify the 12×12 board renders; walls
  auto-join into corners / Ts / ends; a closed wall loop reads as continuous;
  pan works; **taps land on the correct cell at default scale and when zoomed in**;
  building collect and decor place/erase still fire.

## Open questions

None — all design forks resolved during brainstorming (12×12 grid, pinch-zoom +
pan, auto-tiling single wall type, max items 120).

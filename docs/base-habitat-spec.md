# Pet Base / Habitat — design spec

A "build your base" screen where the player sees **all their pets together** in a
scene and spends Pixel Tokens to buy + place decorations on a grid — a cozy,
Clash-of-Clans-flavored home for the collection. Scoped in phases so we can ship
the satisfying core first and decide on the heavier systems later.

The decision (2026-06): **spec first**, build later. This doc is the plan.

---

## Why this fits PixelPets

Almost everything needed already exists as a proven pattern:

- **All pets in one view** — pets are a server-owned collection (`public.pets`,
  loaded by `loadCloudCollection`); the base just renders the whole list with
  `CreatureSprite` instead of the single active pet.
- **Buy + own decorations** — identical to the **backgrounds** cosmetic:
  server-validated price, atomic token deduction, ownership array on the profile.
  (`unlock_background` is the literal template.)
- **Token sink** — placing/unlocking decorations gives tokens another purpose
  beyond eggs/training/slots, all with earned tokens (no Apple-IAP entanglement).

So Phase 1 is mostly assembling known pieces, not inventing systems.

---

## Phase 1 — Habitat MVP (recommended first build)

**Goal:** a 🏡 Habitat screen showing all your pets in a shared scene, on a grid
you decorate with token-bought items. Per-account, layout persists.

### Data model (server)
Mirror the backgrounds pattern.

- `profiles.base_decor_owned text[] not null default '{}'` — decoration ids the
  player has unlocked.
- `profiles.base_layout jsonb not null default '[]'` — placed items:
  `[{ id, x, y }, ...]` where `x`/`y` are grid cells.
- `profiles.base_floor text not null default 'grass'` — the base ground/theme
  (a free default + token-unlockable floors, reusing the same owned-array idea or
  folding into base_decor_owned).

RPCs (all `SECURITY DEFINER`, server-validated — never trust the client):
- **`_decor_price(p_id text) → int`** — server catalog of decoration ids→price
  (mirrors the client `BASE_DECOR` list, like `_background_price`).
- **`unlock_decor(p_id text) → jsonb`** — validate id, deduct price atomically,
  append to `base_decor_owned`. Returns `{ tokens, owned }`. (Copy of
  `unlock_background`.)
- **`save_base_layout(p_layout jsonb) → void`** — validate the layout against
  OWNED decor + grid bounds + a max item count, then store. Rejects items the
  player doesn't own (anti-cheat) and caps array length (anti-abuse).

### Client
- `src/state/base.ts` — `BASE_DECOR` catalog (`{ id, name, price, w, h }`),
  `id → require()` asset map, and `fetchBase` / `unlockDecor` / `saveLayout`
  wrappers with the usual `Result` error surfacing.
- `BaseScreen.tsx` — two modes:
  - **View mode:** the scene with the floor, placed decorations, and all pets
    rendered (idle/wandering) via `CreatureSprite`.
  - **Edit mode:** a token "shop" drawer of decorations + tap-to-place / drag on
    the grid; Save persists via `save_base_layout`.
- `App.tsx` / `GameScreen.tsx` — a `'base'` view + a 🏡 menu tile (it'll live
  under the collapsed MENU like the others).

### Art needed (you)
- A **floor/ground** tile or two (e.g. grass, sand) — full-screen-ish background,
  512×512 PNG works like the pet backgrounds.
- **Decoration sprites** — PNGs with transparency, ideally on a consistent grid
  size (e.g. 64×64 for 1×1 items, 128×64 for 2×1). Suggested starter set: tree,
  bush, fence, pet bed, food bowl, toy ball, pond, rock, lamp post, flowerbed.
  Each gets a `BASE_DECOR` entry (id, name, price, footprint).

### Scope estimate
A focused multi-PR effort (schema + RPCs, then the screen, then polish), each
typecheck-gated. No new economy/PvP systems — low risk.

---

## Phase 2 — Token buildings (optional, bigger)

Buildings that **passively generate tokens over time** (a "token mine" /
"feeder"), collected on a tap.

- New columns: per-building `last_collected` timestamps (or a `base_buildings`
  jsonb with state).
- **`collect_base_income() → jsonb`** — server computes elapsed time × rate,
  caps the accumulation (so you can't bank infinitely), credits tokens atomically.
  All time math server-side (clients can't be trusted with "how long has it
  been" — same lesson as the care-decay work).
- Upgrade levels (higher rate / higher cap for a token cost) optionally layered on.

**Why it's bigger:** introduces a real server-side economy generator + cap/upgrade
logic. Needs balancing so it doesn't wreck the token economy (interacts with the
egg cost, slots RTP, daily caps). Meaningful but self-contained.

---

## Phase 3 — Clash-style raiding (much larger, later)

Other players attack your base; you defend.

- Requires: defensive "stats" for a base, an attacker/defender resolution model
  (reuse the server-authoritative `battle_turn` ideas), raid matchmaking, loot
  rules (what's stolen, shields/cooldowns so people aren't farmed), and a base
  "snapshot" so a raid hits a consistent state.
- This is the part that makes it truly Clash — and the biggest, riskiest piece:
  every reward path must be cheat-proof, and matchmaking/shields need real design.
- Recommend treating this as its own project after Phases 1–2 prove out.

---

## Recommendation

Build **Phase 1 (Habitat)** as the next feature — it delivers ~80% of the
"build your base" feel by reusing the backgrounds/cosmetic + pet-collection
patterns, with no risky new systems. Decide on Phase 2 (buildings) once it's in
players' hands; treat Phase 3 (raids) as a separate, later undertaking.

### To start Phase 1, I need from you
1. Confirm **per-account** (one base) — consistent with how backgrounds work.
2. A rough **grid size** (e.g. 6×6 or 8×8 cells) and how prominent the screen
   should be.
3. The **art**: 1–2 floor tiles + a handful of decoration PNGs (sizes above),
   dropped into `assets/base/`. I can stub Phase 1 with placeholder/coloured
   tiles so the system ships first and art drops in after, if you prefer.

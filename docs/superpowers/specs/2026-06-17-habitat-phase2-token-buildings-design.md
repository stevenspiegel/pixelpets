# Habitat Phase 2 — Token Buildings (design spec)

**Date:** 2026-06-17
**Roadmap context:** Phase 2 of the base-habitat roadmap (`docs/base-habitat-spec.md`).
Phase 1 (Habitat MVP + functional decorations) has shipped. This spec covers the
"token buildings" layer: structures placed in the habitat that **passively accrue
something over time**, capped, and are **collected on a tap**.

---

## Scope (locked decisions)

- **Four building types**, one of each per player, **upgradeable** (3 levels each
  for the first build):
  - **Token Mine** — passive tokens into the balance.
  - **Egg Incubator** — passive *egg shards* (egg-only currency; 150 = 1 free egg).
  - **Care Feeder** — cooldown-gated group care top-up for all pets (no currency).
  - **Treasure Vault** — cooldown-gated random token chest.
- **One of each type** (no multiples). Progression = upgrading levels.
- **On the existing 6×6 habitat grid**, placed like decor; **tap the building
  in-scene to collect** when a readiness badge shows.
- **Income limited only by each building's reservoir cap / cooldown** — there is
  **no separate daily cap** and building income does **not** count toward the
  active-play `DAILY_EARN_CAP` (60/day). Reservoir caps + per-level rates + the
  build/upgrade token sinks are the only balance levers (see Balancing).

Out of scope: multiples of a building, level 4+, Phase 3 raiding, any real-money
entanglement. All income is earned-token only.

---

## Architecture — Approach A (jsonb on `profiles`, keyed by type)

Building state lives in a single new jsonb column on `profiles`, keyed by building
type. This mirrors the existing `base_fuel` jsonb map and keeps all base state in
the one profile row alongside `base_layout` / `base_floor` / `base_fuel`. No new
table, no new RLS surface. (Considered and rejected: a normalized
`base_buildings` table — buys multiples/raid-scale flexibility the locked
decisions don't need; folding into `base_layout` — splits each building across two
structures for no gain.)

Accrued yield is **never stored**. It is always derived server-side at collect
time from elapsed wall-clock, exactly like `refill_decor` computes against
`now()`. The client never sends amounts.

---

## Data model

### Server (`supabase/schema.sql`)

```sql
alter table public.profiles
  add column if not exists base_buildings jsonb   not null default '{}'::jsonb;
alter table public.profiles
  add column if not exists egg_shards     integer not null default 0;
```

`base_buildings` shape (keyed by type; one-of-each):

```json
{
  "mine":      { "level": 1, "x": 2, "y": 3, "collected_at": 1718600000000 },
  "incubator": { "level": 1, "x": 4, "y": 1, "collected_at": 1718600000000 },
  "feeder":    { "level": 2, "x": 0, "y": 5, "collected_at": 1718600000000 },
  "vault":     { "level": 1, "x": 5, "y": 5, "collected_at": 1718600000000 }
}
```

- `collected_at` is **epoch milliseconds** (same unit as `base_fuel.filled_until`).
- For cooldown buildings (Feeder, Vault) "ready" = `now − collected_at ≥ cooldown(level)`.
- For accrual buildings (Mine, Incubator) yield = `min(cap(level), floor((now − collected_at) × rate(level)))`.

### Client (`src/state/base.ts`)

```ts
export type BuildingState = { level: number; x: number; y: number; collectedAt: number };

export type BaseState = {
  // ...existing: owned, layout, pets, floor, fuel
  buildings: Record<string, BuildingState>;
  eggShards: number;
};
```

A read-only `BUILDINGS` catalog mirrors the server (display source of truth split
exactly like `BASE_DECOR` ↔ `_decor_price`):

```ts
export type BuildingDef = {
  id: 'mine' | 'incubator' | 'feeder' | 'vault';
  name: string;
  glyph: string;
  buildCost: number;
  maxLevel: number;       // 3 for the first build
  rate: (level: number) => number;        // yield units per hour (accrual types)
  cap: (level: number) => number;         // reservoir cap (accrual types)
  cooldownMs: (level: number) => number;  // cooldown types
  upgradeCost: (level: number) => number; // tokens level → level+1
};
```

`fetchBase` adds `base_buildings` and `egg_shards` to its `select` and maps them.

---

## Catalog & balancing

Starting numbers (3 levels each). Build/upgrade costs are real token sinks that
gate the income.

| Building | Build cost | Yields | L1 | L2 | L3 |
|---|---|---|---|---|---|
| **Token Mine** | 150 | tokens → balance | 1/hr, cap 12 | 1.5/hr, cap 20 | 2/hr, cap 30 |
| **Egg Incubator** | 200 | egg shards (150 = 1 free egg) | 1/hr, cap 12 | 1.5/hr, cap 20 | 2/hr, cap 30 |
| **Care Feeder** | 120 | group care top-up (no currency) | ready/12h, +40% all stats all pets | /8h, +70% | /6h, +100% |
| **Treasure Vault** | 250 | random token chest | /24h, roll 5–25 (EV ~15) | /20h, 10–40 (EV ~25) | /16h, 15–60 (EV ~35) |

Upgrade costs (tokens): **L1→2 = 80, L2→3 = 160** per building.

### Income-ceiling analysis (no daily cap → rate is the real ceiling)

- Reservoir caps bound an **idle/away** player: Mine banks ≤30 tokens, Incubator
  ≤30 shards before it stops accruing.
- For a player **collecting continuously**, the true daily ceiling is the rate:
  maxed Mine ≈ 48 tok/day, maxed Vault ≈ 50 tok/day (EV), Incubator ≈ 48
  **shards**/day (egg-only, not spendable). A fully-maxed base tops out around
  **~100 tokens/day passive** vs. 60/day from active play.
- **Why acceptable to ship:** reaching max costs ~1,680 tokens sunk
  (Mine 150+80+160=390, Incubator 200+80+160=440, Vault 250+80+160=490,
  Feeder 120+80+160=360 — roughly 11 eggs' worth) before the ceiling is reached. Early/mid game income is
  modest; only a heavily-invested late-game base approaches the ceiling, by which
  point those tokens are already drained from the economy. Self-correcting.
- **Tuning knob:** if it still runs hot, drop max rates to 1.5/hr and lengthen the
  Vault cooldown — pure constant changes, no structural impact.
- The Incubator deliberately pays in **egg-only shards** (not tokens) so the
  biggest sink (hatching) gets a gentler idle path without adding raw spendable
  currency.

---

## Server RPCs

All `SECURITY DEFINER`, `set search_path = public`, atomic under
`select … for update`, `grant execute … to authenticated`, and `revoke` on the
internal `_building_*` helpers — copies of the `unlock_decor` / `refill_decor`
shape.

### Immutable catalog functions (server source of truth)

- `_building_types() → text[]`
- `_building_build_cost(p_type text) → int`
- `_building_max_level(p_type text) → int`
- `_building_rate(p_type text, p_level int) → numeric`  — yield units per **ms**
- `_building_cap(p_type text, p_level int) → int`
- `_building_cooldown_ms(p_type text, p_level int) → bigint`
- `_building_upgrade_cost(p_type text, p_level int) → int`
- `_building_vault_roll(p_level int) → int` — server-rolled chest payout in range

### Public RPCs

- **`build_structure(p_type text, p_x int, p_y int) → jsonb`**
  Validate: known type; not already built; `0 ≤ x,y < grid`; target cell not
  occupied by decor (`base_layout`) or another building. Deduct `build_cost`
  (raise `Not enough tokens` if short). Insert `{ level:1, x, y, collected_at: now_ms }`.
  Returns `{ tokens, base_buildings }`.

- **`upgrade_structure(p_type text) → jsonb`**
  Validate: exists; `level < max_level`. **Collect pending yield first** (so a full
  reservoir isn't lost and the rate doesn't retroactively jump), then deduct
  `upgrade_cost(level)` and bump `level`, set `collected_at = now_ms`.
  Returns `{ tokens, egg_shards, base_buildings }`.

- **`collect_structure(p_type text) → jsonb`**
  Compute elapsed yield and apply by type:
  - `mine` → `tokens += min(cap, floor(elapsed_ms × rate))`
  - `incubator` → `egg_shards += min(cap, floor(elapsed_ms × rate))`
  - `vault` → if `elapsed_ms ≥ cooldown` then `tokens += _building_vault_roll(level)` else raise `Not ready`
  - `feeder` → if `elapsed_ms ≥ cooldown` then top up the caller's pets' care stats
    by the level's percentage (server updates `public.pets` for `owner = me`) else
    raise `Not ready`
  Set `collected_at = now_ms`. Returns `{ tokens, egg_shards, base_buildings }`
  (and the client refetches pets after a feeder collect).

- **`save_base_layout`** (existing) — extend validation so a decor item cannot be
  placed on a cell occupied by a building.

- **Hatch flow (existing egg RPC)** — when `egg_shards ≥ 150`, allow hatching by
  spending 150 shards instead of `EGG_COST` tokens. Server-validated; the client
  only surfaces the option.

---

## Client / UX

### State wrappers (`src/state/base.ts`)

Thin `supabase.rpc` calls returning the usual `Result<T>`, mirroring
`unlockDecor` / `refillDecor`:

- `buildStructure(type, x, y)` → `{ tokens, buildings }`
- `upgradeStructure(type)` → `{ tokens, eggShards, buildings }`
- `collectStructure(type)` → `{ tokens, eggShards, buildings }`

### BaseScreen

- **View mode:** buildings render on the grid via sprite/glyph like decor. A
  building shows a **readiness badge** (glow + 💰/🥚/❤️/🎁 bubble) when it has
  ≥1 unit accrued (accrual types) or its cooldown has elapsed (cooldown types).
  Tapping a ready building calls `collectStructure` and plays a small "+N" float.
- **Edit mode:** a **"Buildings" tab** in the existing shop drawer lists the four
  types with build cost — or `Upgrade → L2 (80⛁)` if already built. Placement
  reuses the decor tap-to-place interaction onto a free cell; building is a
  distinct action (`buildStructure`, not `unlockDecor`).
- **Shards meter:** a small `🥚 120/150` indicator surfaces incubator progress;
  at 150 the hatch screen offers a free egg (the one cross-screen touch — a single
  conditional in the existing hatch flow).
- **Feeder tap:** applies the group care top-up, refreshes pets, shows a heal
  sparkle + toast (no currency animation).

---

## Anti-cheat guarantees (server is the only authority)

- All yield is `now()`-elapsed math server-side; the client never sends amounts.
  `collected_at` is only ever set to `now()`.
- `build` / `upgrade` deduct atomically under `select … for update`; raise on
  insufficient tokens, unknown type, already-built, maxed level, out-of-bounds or
  overlapping cell.
- `save_base_layout` rejects decor placed on a building's occupied cell.
- Vault payout is rolled server-side within the level's range (like `slot_spin`).
- Free-egg hatch validates `egg_shards ≥ 150` server-side before consuming.

---

## Testing & verification

No test runner exists in the repo, so verification matches project norms:

- **Typecheck-gated** per PR (`npm run` typecheck/build).
- **Preview harness** (`scripts/`, following the `base-preview-harness` pattern) to
  eyeball the Buildings tab, placement, and readiness/collect states.
- **Manual RPC verification** against Supabase, documented in a
  `docs/verification-*.md` (like PR #90): build → wait → collect yields the
  expected amount; immediate re-collect yields ~0 / "Not ready"; upgrade collects
  pending first; out-of-bounds / overlap / insufficient-token cases all reject.

---

## Suggested PR sequencing (each typecheck-gated, mirrors how Phase 1 shipped)

1. **Schema:** `base_buildings` + `egg_shards` columns, `_building_*` catalog
   functions, `build_structure` / `upgrade_structure` / `collect_structure` RPCs,
   `save_base_layout` overlap guard. Apply to the live DB (Supabase SQL Editor).
2. **Client:** `BaseState` + `BUILDINGS` catalog + wrappers; BaseScreen Buildings
   tab, placement, collect, readiness badges.
3. **Polish:** Incubator → free-egg hatch hook, Feeder group heal, shards meter,
   preview-harness + verification doc.

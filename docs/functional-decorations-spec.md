# Functional Decorations — design spec

Make a subset of base decorations **functional**: while placed and fueled, they
slow the real-time decay of one care stat for *all* the player's pets. Fuel
drains over real time and is topped back up with Pixel Tokens — a recurring
token sink that gives the habitat ongoing purpose beyond cosmetics.

Builds directly on the shipped Base/Habitat feature (see
[`base-habitat-spec.md`](base-habitat-spec.md)) and the server-authoritative
care system (`_decay_pet_row` / `care_action` in
[`supabase/schema.sql`](../supabase/schema.sql)).

The decision (2026-06-16): brainstormed and approved. This doc is the plan.

---

## The ownership constraint (why there's no count-stacking)

`unlock_decor` is **buy-once per type, place-many**: it rejects re-buys
(`Already unlocked`), after which the player can place unlimited copies of that
type for free (up to the 40-tile grid cap). Two consequences shape the design:

1. **Stacking by placement count would be free to exploit** — one 40-token
   purchase could place enough bowls to max any cap at no further cost.
2. With **whole-base scope** (an item helps every pet), multiple copies of the
   same item all feed the same shared stat pool, so "more copies = more effect"
   has no coherent meaning.

So the effect is **binary per stat**: the stat's item is either *fueled*
(−40% decay) or *not fueled* (no effect). There is no count-based stacking or
60% cap. The entire token sink lives in **refills**, not placements.

---

## Effect model

Each functional decoration maps to exactly one care stat. While that item is
**placed on the grid AND fueled**, that stat decays **40% slower** for **all**
of the owner's pets (whole-base scope).

| item       | id     | stat slowed | decay rate touched (`_decay_pet_row`) |
| ---------- | ------ | ----------- | ------------------------------------- |
| Food Bowl  | `bowl` | hunger      | `0.01 /s`  → ×0.6                      |
| Toy Ball   | `ball` | happiness   | `0.008 /s` → ×0.6                      |
| Pet Bed    | `bed`  | energy      | `0.007 /s` (awake drain) → ×0.6       |
| Pond       | `pond` | cleanliness | `0.005 /s` → ×0.6                      |

- The other six decorations (`fence`, `rock`, `bush`, `flowers`, `tree`,
  `lamp`) stay purely cosmetic.
- **Health is not directly placeable** — it's derived. It already recovers when
  hunger/happiness/cleanliness stay high, so functional items help it
  indirectly.
- An item must be **both placed and fueled** to take effect. Owned-but-unplaced
  does nothing; placed-but-empty does nothing (reverts to cosmetic).

### Balance constants

| knob                  | value                              |
| --------------------- | ---------------------------------- |
| Decay reduction       | 40% (multiplier `0.6`) per stat    |
| Fuel per fill         | 48 hours of real time              |
| Refill cost           | 15 tokens (to full)                |
| First fill            | **free**, granted on purchase      |
| Depletion             | real-time wall clock (always)      |
| Empty behavior        | no effect until refilled           |

For reference: an egg costs 150 tokens; these items cost 40 (bowl/ball), 80
(bed), 120 (pond) to unlock.

---

## Data model (server)

Fuel state is **server-owned** — never trust the client with "how much fuel is
left" (same lesson as the care-decay work).

- `profiles.base_fuel jsonb not null default '{}'` — map of functional decor id
  → `filled_until_ms` (epoch millis):
  `{ "bowl": 1718600000000, "ball": …, "bed": …, "pond": … }`.
- **Not** writable via the client-facing `save_base_layout` (that RPC stays
  scoped to placement/positions/floor only). Fuel changes only through
  `unlock_decor` (first free fill) and `refill_decor` (paid top-up).
- Keyed by **type, not tile** — so moving an item around the grid never resets
  or re-grants fuel (no move-to-refill exploit).

---

## RPCs (all `SECURITY DEFINER`, server-validated)

- **`unlock_decor(p_id)`** *(existing, amended)* — when the purchased id is a
  functional item, also set `base_fuel[p_id] = now_ms + 48h` (the free first
  fill). Non-functional purchases unchanged.
- **`refill_decor(p_id) → jsonb`** *(new)* — validate that `p_id` is an owned
  functional item; charge **15 tokens** atomically; set
  `base_fuel[p_id] = now_ms + 48h`. Returns `{ tokens, base_fuel }`. Rejects
  unknown/non-functional/unowned ids and insufficient balance.
- **`_base_care_mult(p_owner uuid) → jsonb`** *(new helper, no auth, revoked
  from clients)* — returns per-stat decay multipliers, e.g.
  `{ "hunger": 0.6, "happiness": 1, "cleanliness": 0.6, "energy": 1 }`, by
  checking, per functional type, whether it is **placed** (present in
  `base_layout`) AND **fueled** (`now_ms < base_fuel[id]`). Defaults to `1`
  (no effect) for any stat whose item isn't both.
- **`_decay_pet_row(pet, p_mult jsonb default '{}')`** *(existing, amended)* —
  add an optional multiplier param defaulting to `{}` (= no effect, fully
  backward compatible). When provided, multiply the relevant per-stat decay
  term by its multiplier. `care_action` computes `p_mult` once via
  `_base_care_mult(me)` and passes it in.

### `_decay_pet_row` callers to update

`care_action` is the primary caller (passes the real multiplier). Any other
caller (e.g. batch tick/sync paths) keeps working unchanged thanks to the `{}`
default; audit callers during implementation and decide per-call whether to
thread the multiplier through.

---

## Client

`src/state/base.ts`:
- Add a `FUNCTIONAL_DECOR` map (`id → { stat }`) and surface it on `DecorDef`
  (e.g. optional `functional?: 'hunger' | 'happiness' | 'cleanliness' |
  'energy'`).
- Extend `BaseState` with `fuel: Record<string, number>` from
  `profiles.base_fuel`; thread it through `fetchBase`.
- Add `refillDecor(id)` wrapper (mirrors `unlockDecor`, returns the new wallet +
  fuel).
- Mirror the balance constants (48h, 15 tokens, 0.6) as named exports; server
  remains the source of truth.

`BaseScreen.tsx`:
- In the edit/shop drawer, functional items show a **fuel gauge** —
  "Fueled · 41h left" vs. "Empty" — and a **Refill (15)** button (disabled when
  not owned or insufficient tokens).
- Optional polish: a small fuel/empty indicator on placed functional items in
  view mode.

---

## Scope estimate

A focused, typecheck-gated effort. Server piece (schema column + `refill_decor`
+ `_base_care_mult` + `_decay_pet_row` param) and client piece (state wrapper +
shop UI). No new economy generators or PvP — low risk; it reuses the
cosmetic/unlock and server-care patterns already proven in the codebase.

---

## Out of scope (deferred)

- Count-based stacking / per-tile reservoirs (ruled out by the ownership model
  above).
- Proximity/adjacency effects (whole-base chosen for simplicity).
- A health-restoring item (health stays derived).
- Phase 2/3 of the habitat roadmap (token buildings, raids) — separate specs.

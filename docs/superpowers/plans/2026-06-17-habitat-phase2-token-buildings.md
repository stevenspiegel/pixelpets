# Habitat Phase 2 — Token Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four one-of-each, upgradeable buildings (Token Mine, Egg Incubator, Care Feeder, Treasure Vault) to the habitat grid that passively accrue over time and are collected on a tap, with all yield computed server-side.

**Architecture:** Building state lives in a new `profiles.base_buildings` jsonb keyed by type (`{ "<type>": {level,x,y,collected_at} }`), mirroring the existing `base_fuel` map. Accrued yield is never stored — it's derived from `now()`-elapsed at collect time, exactly like `refill_decor`. New `SECURITY DEFINER` RPCs (`build_structure`, `upgrade_structure`, `collect_structure`) do all token math atomically. Client mirrors the catalog read-only in `src/state/base.ts` and renders/collects in `src/components/BaseScreen.tsx`.

**Tech Stack:** Expo / React Native 0.74 + TypeScript, Supabase (Postgres + plpgsql RPCs), Sprite-AI art pipeline (`scripts/make-base.mjs`).

## Global Constraints

- **Custom art only.** Every building sprite MUST be generated via the project's Sprite-AI pipeline (`scripts/generate-spriteai.mjs` → `scripts/make-base.mjs` → `assets/base/<id>.png` → wired in `src/base/images.ts`). NO third-party / stock / clip art. Emoji glyphs are temporary code placeholders only.
- **No JS test runner exists.** Verification per task = `npm run typecheck` (must pass clean) + manual SQL in the Supabase SQL Editor for RPCs + `npm run preview:base` for UI. Do not invent a Jest/pytest harness.
- **Server is the only economy authority.** The client never sends token/shard/yield amounts. `collected_at` is only ever set to server `now()`. All deductions are atomic under `select … for update` and `raise exception` on bad input.
- **Schema is one file, applied manually.** All SQL goes in `supabase/schema.sql` (idempotent `create or replace` / `add column if not exists`). Applying to the live DB = paste into the Supabase SQL Editor (the repo has no migration runner).
- **One-of-each, 3 levels each.** No multiples. `_building_max_level` = 3.
- **Catalog mirrored in two places, kept in sync:** server `_building_*` functions are the source of truth; `src/state/base.ts` `BUILDINGS` mirrors them for display. Epoch values are **milliseconds** everywhere (matches `base_fuel`).
- **Income relies only on per-building caps/cooldowns** — there is no daily cap and building income does NOT touch `earn_play_tokens` / `DAILY_EARN_CAP`.

---

## File Structure

- `supabase/schema.sql` — **Modify.** New columns (`base_buildings`, `egg_shards`), `_building_*` catalog functions, `build_structure` / `upgrade_structure` / `collect_structure` RPCs, `save_base_layout` building-overlap guard, `hatch_pet` egg-shard path. (Tasks 1–3, 9)
- `src/state/base.ts` — **Modify.** `BuildingState`/`BaseState` types, `BUILDINGS` catalog + helpers, `buildStructure`/`upgradeStructure`/`collectStructure` wrappers, `egg_shards` in `fetchBase`. (Task 4)
- `assets/base/{mine,incubator,feeder,vault}.png` — **Create** via Sprite-AI. (Task 5)
- `src/base/images.ts` — **Modify.** `BUILDING_ART` map + `buildingArt()` helper. (Task 5)
- `src/components/BaseScreen.tsx` — **Modify.** Render buildings on the grid with readiness badge + tap-to-collect (view mode); a BUILDINGS section in the edit shop to build/upgrade/place. (Tasks 6–7)
- `src/dev/BasePreview.tsx` — **Modify.** Seed a couple of buildings into the preview state so the harness exercises them. (Task 8)
- `src/state/usePet.ts` + hatch UI — **Modify.** Surface a "hatch with shards" option when `eggShards >= 150`. (Task 9)

---

## Task 1: Schema — columns + `_building_*` catalog functions

**Files:**
- Modify: `supabase/schema.sql` (append a new "Phase 2: token buildings" section after the `refill_decor` / `_base_care_mult` block, ~line 599)

**Interfaces:**
- Produces (SQL, server source of truth):
  - `_building_types() → text[]`
  - `_building_build_cost(p_type text) → integer` (null = unknown)
  - `_building_max_level(p_type text) → integer`
  - `_building_upgrade_cost(p_type text, p_level integer) → integer` (null = maxed)
  - `_building_rate(p_type text, p_level integer) → double precision` (units **per ms**)
  - `_building_cap(p_type text, p_level integer) → integer`
  - `_building_cooldown_ms(p_type text, p_level integer) → bigint`
  - `_building_feeder_pct(p_level integer) → double precision`
  - `_building_vault_roll(p_level integer) → integer`

- [ ] **Step 1: Append the columns + catalog functions to `supabase/schema.sql`**

```sql
-- ── Phase 2: token buildings ──────────────────────────────────────────────────
-- One-of-each, upgradeable structures placed on the habitat grid that passively
-- accrue over time, collected on a tap. State lives in base_buildings jsonb keyed
-- by type: { "<type>": { level, x, y, collected_at } }. collected_at is epoch ms
-- (same unit as base_fuel). Accrued yield is NEVER stored — it's derived server-
-- side from now()-elapsed at collect time (cheat-proof), exactly like refill_decor.
-- The catalog below is the source of truth; src/state/base.ts BUILDINGS mirrors it.
alter table public.profiles
  add column if not exists base_buildings jsonb   not null default '{}'::jsonb,
  add column if not exists egg_shards     integer not null default 0;

create or replace function public._building_types() returns text[]
  language sql immutable as $$ select array['mine','incubator','feeder','vault'] $$;

create or replace function public._building_max_level(p_type text) returns integer
  language sql immutable as $$ select 3 $$;   -- 3 levels each (first build)

create or replace function public._building_build_cost(p_type text) returns integer
  language sql immutable as $$
  select case p_type
    when 'mine' then 150 when 'incubator' then 200
    when 'feeder' then 120 when 'vault' then 250 else null end;
$$;

-- Tokens to go from p_level → p_level+1; null when already at max level.
create or replace function public._building_upgrade_cost(p_type text, p_level integer) returns integer
  language sql immutable as $$
  select case p_level when 1 then 80 when 2 then 160 else null end;
$$;

-- Accrual rate in UNITS PER MILLISECOND (mine→tokens, incubator→shards).
-- Per-hour rates L1 1 / L2 1.5 / L3 2, divided by 3,600,000.
create or replace function public._building_rate(p_type text, p_level integer) returns double precision
  language sql immutable as $$
  select (case p_level when 1 then 1.0 when 2 then 1.5 when 3 then 2.0 else 0 end) / 3600000.0;
$$;

-- Reservoir cap (max accrued units between collects) for accrual buildings.
create or replace function public._building_cap(p_type text, p_level integer) returns integer
  language sql immutable as $$
  select case p_level when 1 then 12 when 2 then 20 when 3 then 30 else 0 end;
$$;

-- Cooldown in ms for cooldown buildings (feeder, vault).
create or replace function public._building_cooldown_ms(p_type text, p_level integer) returns bigint
  language sql immutable as $$
  select ((case p_type
    when 'feeder' then (case p_level when 1 then 12 when 2 then 8  when 3 then 6  else 0 end)
    when 'vault'  then (case p_level when 1 then 24 when 2 then 20 when 3 then 16 else 0 end)
    else 0 end) * 3600 * 1000)::bigint;
$$;

-- Feeder: fraction (0..1) each care stat is topped up by, per level.
create or replace function public._building_feeder_pct(p_level integer) returns double precision
  language sql immutable as $$
  select case p_level when 1 then 0.40 when 2 then 0.70 when 3 then 1.0 else 0 end;
$$;

-- Vault: random chest payout in tokens within the level's range. Server-rolled
-- (volatile), like slot_spin — the client can never request an amount.
create or replace function public._building_vault_roll(p_level integer) returns integer
  language plpgsql volatile as $$
  declare lo int; hi int;
  begin
    case p_level
      when 1 then lo := 5;  hi := 25;
      when 2 then lo := 10; hi := 40;
      when 3 then lo := 15; hi := 60;
      else lo := 0; hi := 0;
    end case;
    return lo + floor(random() * (hi - lo + 1))::int;
  end; $$;

-- These are internal helpers — callable only by the SECURITY DEFINER RPCs below.
revoke execute on function public._building_types()                       from public, anon, authenticated;
revoke execute on function public._building_max_level(text)               from public, anon, authenticated;
revoke execute on function public._building_build_cost(text)              from public, anon, authenticated;
revoke execute on function public._building_upgrade_cost(text, integer)   from public, anon, authenticated;
revoke execute on function public._building_rate(text, integer)           from public, anon, authenticated;
revoke execute on function public._building_cap(text, integer)            from public, anon, authenticated;
revoke execute on function public._building_cooldown_ms(text, integer)    from public, anon, authenticated;
revoke execute on function public._building_feeder_pct(integer)           from public, anon, authenticated;
revoke execute on function public._building_vault_roll(integer)           from public, anon, authenticated;
```

- [ ] **Step 2: Apply to the database**

Paste the new block into the Supabase SQL Editor and run it. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify the catalog returns expected values**

Run in the SQL Editor:
```sql
select public._building_build_cost('mine')        as mine_cost,      -- 150
       public._building_upgrade_cost('mine', 2)    as up_l2,          -- 160
       public._building_cap('mine', 3)             as cap_l3,         -- 30
       public._building_cooldown_ms('vault', 1)    as vault_cd_ms,    -- 86400000
       public._building_rate('mine', 3) * 3600000  as mine_per_hour;  -- 2
```
Expected: a single row `150, 160, 30, 86400000, 2`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Phase 2 schema: base_buildings/egg_shards columns + _building_* catalog"
```

---

## Task 2: Schema — `build_structure`, `upgrade_structure`, `collect_structure` + layout overlap guard

**Files:**
- Modify: `supabase/schema.sql` (immediately after the Task 1 block; plus edit the existing `save_base_layout`, ~line 612)

**Interfaces:**
- Consumes: all `_building_*` functions (Task 1), `_base_grid()` (existing).
- Produces (SQL RPCs, granted to `authenticated`):
  - `build_structure(p_type text, p_x integer, p_y integer) → jsonb` → `{ tokens, base_buildings }`
  - `upgrade_structure(p_type text) → jsonb` → `{ tokens, egg_shards, base_buildings }`
  - `collect_structure(p_type text) → jsonb` → `{ tokens, egg_shards, base_buildings, yield }`

- [ ] **Step 1: Append the three RPCs to `supabase/schema.sql`**

```sql
-- Build a structure: validate type, that it isn't already built, grid bounds, and
-- that the target cell is free of decor and other buildings; charge the build cost
-- atomically; insert at level 1 with collected_at = now. Returns wallet + buildings.
create or replace function public.build_structure(p_type text, p_x integer, p_y integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  grid   integer := public._base_grid();
  cost   integer := public._building_build_cost(p_type);
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  bal    integer;
  blds   jsonb;
  lay    jsonb;
  ent    jsonb;
begin
  if cost is null then raise exception 'Unknown building'; end if;
  if p_x < 0 or p_y < 0 or p_x >= grid or p_y >= grid then raise exception 'Off-grid placement'; end if;
  select tokens, base_buildings, base_layout into bal, blds, lay
    from public.profiles where id = me for update;
  if blds ? p_type then raise exception 'Already built'; end if;
  if exists (
    select 1 from jsonb_array_elements(lay) as it
    where (it->>'x')::int = p_x and (it->>'y')::int = p_y
  ) then raise exception 'Cell occupied'; end if;
  for ent in select value from jsonb_each(blds) loop
    if (ent->>'x')::int = p_x and (ent->>'y')::int = p_y then raise exception 'Cell occupied'; end if;
  end loop;
  if bal < cost then raise exception 'Not enough tokens'; end if;
  blds := jsonb_set(blds, array[p_type],
    jsonb_build_object('level', 1, 'x', p_x, 'y', p_y, 'collected_at', now_ms), true);
  update public.profiles set tokens = tokens - cost, base_buildings = blds
    where id = me returning tokens into bal;
  return jsonb_build_object('tokens', bal, 'base_buildings', blds);
end; $$;
grant execute on function public.build_structure(text, integer, integer) to authenticated;

-- Collect a structure's accrued yield and reset collected_at to now.
--   mine      → tokens += min(cap, floor(elapsed_ms * rate))
--   incubator → egg_shards += min(cap, floor(elapsed_ms * rate))
--   vault     → tokens += server-rolled chest (only once cooldown elapsed)
--   feeder    → top up every owned pet's care stats by the level's % (cooldown-gated)
-- Returns wallet + shards + buildings + the yield amount (0 for feeder).
create or replace function public.collect_structure(p_type text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  now_ms  bigint := (extract(epoch from now()) * 1000)::bigint;
  bal     integer;
  shards  integer;
  blds    jsonb;
  b       jsonb;
  lvl     integer;
  coll    bigint;
  elapsed bigint;
  yield   integer := 0;
  pct     double precision;
begin
  select tokens, egg_shards, base_buildings into bal, shards, blds
    from public.profiles where id = me for update;
  b := blds -> p_type;
  if b is null then raise exception 'Not built'; end if;
  lvl  := (b->>'level')::int;
  coll := (b->>'collected_at')::bigint;
  elapsed := greatest(0, now_ms - coll);

  if p_type = 'mine' then
    yield := least(public._building_cap(p_type, lvl), floor(elapsed * public._building_rate(p_type, lvl))::int);
    if yield <= 0 then raise exception 'Nothing to collect yet'; end if;
    bal := bal + yield;
  elsif p_type = 'incubator' then
    yield := least(public._building_cap(p_type, lvl), floor(elapsed * public._building_rate(p_type, lvl))::int);
    if yield <= 0 then raise exception 'Nothing to collect yet'; end if;
    shards := shards + yield;
  elsif p_type = 'vault' then
    if elapsed < public._building_cooldown_ms(p_type, lvl) then raise exception 'Not ready'; end if;
    yield := public._building_vault_roll(lvl);
    bal := bal + yield;
  elsif p_type = 'feeder' then
    if elapsed < public._building_cooldown_ms(p_type, lvl) then raise exception 'Not ready'; end if;
    pct := public._building_feeder_pct(lvl);
    update public.pets set
      hunger      = least(100, hunger      + 100 * pct),
      happiness   = least(100, happiness   + 100 * pct),
      cleanliness = least(100, cleanliness + 100 * pct),
      energy      = least(100, energy      + 100 * pct)
    where owner = me;
  else
    raise exception 'Unknown building';
  end if;

  blds := jsonb_set(blds, array[p_type, 'collected_at'], to_jsonb(now_ms));
  update public.profiles set tokens = bal, egg_shards = shards, base_buildings = blds where id = me;
  return jsonb_build_object('tokens', bal, 'egg_shards', shards, 'base_buildings', blds, 'yield', yield);
end; $$;
grant execute on function public.collect_structure(text) to authenticated;

-- Upgrade a structure one level. Banks any pending accrual at the CURRENT level
-- first (so the higher rate can't apply retroactively), then charges the upgrade
-- cost and bumps the level, resetting collected_at. Returns wallet + shards + buildings.
create or replace function public.upgrade_structure(p_type text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me      uuid := auth.uid();
  now_ms  bigint := (extract(epoch from now()) * 1000)::bigint;
  bal     integer;
  shards  integer;
  blds    jsonb;
  b       jsonb;
  lvl     integer;
  coll    bigint;
  elapsed bigint;
  cost    integer;
begin
  select tokens, egg_shards, base_buildings into bal, shards, blds
    from public.profiles where id = me for update;
  b := blds -> p_type;
  if b is null then raise exception 'Not built'; end if;
  lvl  := (b->>'level')::int;
  cost := public._building_upgrade_cost(p_type, lvl);
  if cost is null then raise exception 'Already max level'; end if;
  if bal < cost then raise exception 'Not enough tokens'; end if;
  coll := (b->>'collected_at')::bigint;
  elapsed := greatest(0, now_ms - coll);
  if p_type = 'mine' then
    bal := bal + least(public._building_cap(p_type, lvl), floor(elapsed * public._building_rate(p_type, lvl))::int);
  elsif p_type = 'incubator' then
    shards := shards + least(public._building_cap(p_type, lvl), floor(elapsed * public._building_rate(p_type, lvl))::int);
  end if;
  bal := bal - cost;
  blds := jsonb_set(blds, array[p_type, 'level'], to_jsonb(lvl + 1));
  blds := jsonb_set(blds, array[p_type, 'collected_at'], to_jsonb(now_ms));
  update public.profiles set tokens = bal, egg_shards = shards, base_buildings = blds where id = me;
  return jsonb_build_object('tokens', bal, 'egg_shards', shards, 'base_buildings', blds);
end; $$;
grant execute on function public.upgrade_structure(text) to authenticated;
```

- [ ] **Step 2: Add the building-overlap guard to the existing `save_base_layout`**

In `supabase/schema.sql`, find the existing `save_base_layout` (the `create or replace function public.save_base_layout(p_layout jsonb, p_floor text, p_pets jsonb default '[]')` block, ~line 612). Change the `declare` line that reads:
```sql
  owned text[];
```
to also fetch buildings:
```sql
  owned text[];
  blds  jsonb;
  ent   jsonb;
```
Change the existing select:
```sql
  select base_decor_owned into owned from public.profiles where id = me;
```
to:
```sql
  select base_decor_owned, base_buildings into owned, blds from public.profiles where id = me;
```
Then, inside the decor loop, immediately after the existing off-grid check:
```sql
    if ix < 0 or iy < 0 or ix >= grid or iy >= grid then
      raise exception 'Off-grid placement';
    end if;
```
add the overlap guard:
```sql
    for ent in select value from jsonb_each(blds) loop
      if (ent->>'x')::int = ix and (ent->>'y')::int = iy then
        raise exception 'Cell has a building';
      end if;
    end loop;
```

- [ ] **Step 3: Apply to the database**

Paste the three new RPCs and the edited `save_base_layout` into the Supabase SQL Editor and run. Expected: "Success. No rows returned."

- [ ] **Step 4: Manually verify the full build → collect → re-collect cycle**

Run as a logged-in test user (replace the session as needed; in the SQL Editor `auth.uid()` resolves to your editor identity — use a row you own). Sequence:
```sql
-- build a mine at (0,0)
select public.build_structure('mine', 0, 0);                 -- tokens drop by 150
-- immediately collecting yields nothing
select public.collect_structure('mine');                     -- EXPECT: ERROR "Nothing to collect yet"
-- simulate 5h elapsed by backdating collected_at, then collect
update public.profiles
  set base_buildings = jsonb_set(base_buildings, array['mine','collected_at'],
      to_jsonb(((extract(epoch from now())*1000)::bigint) - 5*3600*1000))
  where id = auth.uid();
select public.collect_structure('mine');                     -- EXPECT: yield 5 (cap 12 at L1), tokens += 5
-- duplicate build rejected
select public.build_structure('mine', 1, 1);                 -- EXPECT: ERROR "Already built"
-- vault not-ready
select public.build_structure('vault', 2, 2);
select public.collect_structure('vault');                    -- EXPECT: ERROR "Not ready"
```
Confirm each `EXPECT` matches. Clean up the test rows afterward if desired:
```sql
update public.profiles set base_buildings = '{}'::jsonb where id = auth.uid();
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "Phase 2 schema: build/upgrade/collect RPCs + layout building-overlap guard"
```

---

## Task 3: Client state — types, catalog, wrappers (`src/state/base.ts`)

**Files:**
- Modify: `src/state/base.ts`

**Interfaces:**
- Produces (TS, consumed by Tasks 5–9):
  - `type BuildingId = 'mine' | 'incubator' | 'feeder' | 'vault'`
  - `type BuildingState = { level: number; x: number; y: number; collectedAt: number }`
  - `BaseState` gains `buildings: Record<string, BuildingState>` and `eggShards: number`
  - `BUILDINGS: BuildingDef[]` with `buildCost`, `maxLevel`, `glyph`, `kind: 'accrual' | 'cooldown'`, `unit`, `ratePerHour(level)`, `cap(level)`, `cooldownMs(level)`, `upgradeCost(level)`
  - `buildingById(id) → BuildingDef | undefined`
  - `EGG_SHARDS_PER_EGG = 150`
  - `buildStructure(type, x, y) → Result<{ tokens; buildings }>`
  - `upgradeStructure(type) → Result<{ tokens; eggShards; buildings }>`
  - `collectStructure(type) → Result<{ tokens; eggShards; buildings; yield: number }>`
- Consumes: existing `supabase`, `Result`, `cleanError`, `fetchBase` shape.

- [ ] **Step 1: Add building types + catalog after the existing `Placed`/`PlacedPet`/`BaseState` block**

In `src/state/base.ts`, after `export const functionalStat = ...` (line ~72) and before `export type Placed`, add:
```ts
// ── Phase 2: token buildings ────────────────────────────────────────────────
// One-of-each, upgradeable structures placed on the grid that passively accrue
// over time, collected on a tap. Display catalog only — prices/rates/caps are
// re-validated server-side (_building_* in supabase/schema.sql is source of truth).
export type BuildingId = 'mine' | 'incubator' | 'feeder' | 'vault';

export const EGG_SHARDS_PER_EGG = 150; // mirrors hatch_pet shard cost

export type BuildingDef = {
  id: BuildingId;
  name: string;
  glyph: string;                 // temporary placeholder until art is wired
  buildCost: number;
  maxLevel: number;
  kind: 'accrual' | 'cooldown';
  unit: 'tokens' | 'shards' | 'care';
  ready: string;                 // emoji shown on the readiness badge
  ratePerHour: (level: number) => number; // accrual buildings (display)
  cap: (level: number) => number;         // accrual reservoir cap
  cooldownMs: (level: number) => number;  // cooldown buildings
  upgradeCost: (level: number) => number | null; // null = maxed
};

const HOUR = 3600 * 1000;
const upCost = (level: number): number | null =>
  level === 1 ? 80 : level === 2 ? 160 : null;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'mine', name: 'Token Mine', glyph: '⛏️', buildCost: 150, maxLevel: 3,
    kind: 'accrual', unit: 'tokens', ready: '💰',
    ratePerHour: (l) => [0, 1, 1.5, 2][l] ?? 0,
    cap: (l) => [0, 12, 20, 30][l] ?? 0,
    cooldownMs: () => 0, upgradeCost: upCost,
  },
  {
    id: 'incubator', name: 'Egg Incubator', glyph: '🥚', buildCost: 200, maxLevel: 3,
    kind: 'accrual', unit: 'shards', ready: '🥚',
    ratePerHour: (l) => [0, 1, 1.5, 2][l] ?? 0,
    cap: (l) => [0, 12, 20, 30][l] ?? 0,
    cooldownMs: () => 0, upgradeCost: upCost,
  },
  {
    id: 'feeder', name: 'Care Feeder', glyph: '🍼', buildCost: 120, maxLevel: 3,
    kind: 'cooldown', unit: 'care', ready: '❤️',
    ratePerHour: () => 0, cap: () => 0,
    cooldownMs: (l) => ([0, 12, 8, 6][l] ?? 0) * HOUR,
    upgradeCost: upCost,
  },
  {
    id: 'vault', name: 'Treasure Vault', glyph: '🎁', buildCost: 250, maxLevel: 3,
    kind: 'cooldown', unit: 'tokens', ready: '🎁',
    ratePerHour: () => 0, cap: () => 0,
    cooldownMs: (l) => ([0, 24, 20, 16][l] ?? 0) * HOUR,
    upgradeCost: upCost,
  },
];

export const buildingById = (id: string): BuildingDef | undefined =>
  BUILDINGS.find((b) => b.id === id);

// How much an accrual building has produced since last collect (client estimate
// for the readiness badge; the server re-computes authoritatively on collect).
export const accrued = (def: BuildingDef, st: BuildingState, now: number): number =>
  Math.min(def.cap(st.level), Math.floor(((now - st.collectedAt) / HOUR) * def.ratePerHour(st.level)));

// Whether a building is collectible right now (badge logic).
export const isReady = (def: BuildingDef, st: BuildingState, now: number): boolean =>
  def.kind === 'accrual'
    ? accrued(def, st, now) >= 1
    : now - st.collectedAt >= def.cooldownMs(st.level);

export type BuildingState = { level: number; x: number; y: number; collectedAt: number };
```

- [ ] **Step 2: Extend `BaseState` and `fetchBase`**

Change the `BaseState` type (line ~77) to add the two fields:
```ts
export type BaseState = {
  owned: string[];
  layout: Placed[];
  pets: PlacedPet[];
  floor: string;
  fuel: Record<string, number>; // decor id → filled_until (epoch ms)
  buildings: Record<string, BuildingState>;
  eggShards: number;
};
```
In `fetchBase`, update the `fallback` literal to include `buildings: {}, eggShards: 0`, add `base_buildings, egg_shards` to the `.select(...)` string, and map them in the returned object:
```ts
    buildings: (d.base_buildings as Record<string, BuildingState>) ?? {},
    eggShards: Number(d.egg_shards ?? 0),
```

- [ ] **Step 3: Add the three RPC wrappers after `saveBaseLayout`**

```ts
// Build / upgrade / collect a structure. Server charges + computes yield; the
// client only triggers and reads back the new wallet + buildings map.
export const buildStructure = async (
  type: BuildingId, x: number, y: number
): Promise<Result<{ tokens: number; buildings: Record<string, BuildingState> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('build_structure', { p_type: type, p_x: x, p_y: y });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: { tokens: Number(d.tokens), buildings: (d.base_buildings ?? {}) } };
};

export const upgradeStructure = async (
  type: BuildingId
): Promise<Result<{ tokens: number; eggShards: number; buildings: Record<string, BuildingState> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('upgrade_structure', { p_type: type });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: { tokens: Number(d.tokens), eggShards: Number(d.egg_shards), buildings: (d.base_buildings ?? {}) } };
};

export const collectStructure = async (
  type: BuildingId
): Promise<Result<{ tokens: number; eggShards: number; buildings: Record<string, BuildingState>; yield: number }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('collect_structure', { p_type: type });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: {
    tokens: Number(d.tokens), eggShards: Number(d.egg_shards),
    buildings: (d.base_buildings ?? {}), yield: Number(d.yield ?? 0),
  } };
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors. (If `BuildingState` is referenced in `BaseState` before its declaration, move the `export type BuildingState` line above the `BaseState` block — TS type declarations hoist, but keep it tidy.)

- [ ] **Step 5: Commit**

```bash
git add src/state/base.ts
git commit -m "Phase 2 client state: BUILDINGS catalog + build/upgrade/collect wrappers"
```

---

## Task 4: Building art — generate in Sprite-AI and wire it

**Files:**
- Create: `assets/base/mine.png`, `assets/base/incubator.png`, `assets/base/feeder.png`, `assets/base/vault.png`
- Modify: `src/base/images.ts`

**Interfaces:**
- Produces: `buildingArt(id) → ImageSourcePropType | undefined`
- Consumes: nothing (art generation is standalone).

> **Constraint reminder:** art MUST come from Sprite-AI via the project pipeline. Do not download or hand-pick third-party images.

- [ ] **Step 1: Generate the four building sprites with Sprite-AI**

Use the existing pipeline (see `scripts/SPRITES.md` and `scripts/generate-spriteai.mjs`; API key in gitignored `.env` as `SPRITE_AI_API_KEY`). Generate a 64×64-friendly pixel sprite per building with prompts matching the habitat's cozy pixel style, transparent background, e.g.:
  - mine: "pixel art mine cart full of gold coins, isometric, transparent background"
  - incubator: "pixel art egg incubator machine with a glowing egg, transparent background"
  - feeder: "pixel art automatic pet food feeder station, transparent background"
  - vault: "pixel art treasure chest vault overflowing with coins, transparent background"

Then run each generated PNG through the base pipeline (background knockout / trim / fit), which writes `assets/base/<id>.png`:
```bash
node scripts/make-base.mjs <generated-mine.png> mine
node scripts/make-base.mjs <generated-incubator.png> incubator
node scripts/make-base.mjs <generated-feeder.png> feeder
node scripts/make-base.mjs <generated-vault.png> vault
```
(If `make-base.mjs`'s argument order differs, follow its `--help` / the usage already used for the existing decor in `assets/base/`.)

- [ ] **Step 2: Review the generated art on a contact sheet**

Run: `node scripts/contact-sheet-base.mjs mine incubator feeder vault`
Expected: a review sheet showing four clean, transparent, on-style 64px sprites. Regenerate any that clash with the existing decor palette before continuing.

- [ ] **Step 3: Wire the art in `src/base/images.ts`**

Add below `DECOR_ART`:
```ts
// PNG art for Phase 2 buildings, keyed by building id in src/state/base.ts.
// Falls back to the catalog glyph when an id is missing (same pattern as decor).
export const BUILDING_ART: Record<string, ImageSourcePropType> = {
  mine: require('../../assets/base/mine.png'),
  incubator: require('../../assets/base/incubator.png'),
  feeder: require('../../assets/base/feeder.png'),
  vault: require('../../assets/base/vault.png'),
};

export const buildingArt = (id: string): ImageSourcePropType | undefined =>
  BUILDING_ART[id];
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (the `require` paths resolve because the PNGs now exist).

- [ ] **Step 5: Commit**

```bash
git add assets/base/mine.png assets/base/incubator.png assets/base/feeder.png assets/base/vault.png src/base/images.ts
git commit -m "Phase 2 art: Sprite-AI building sprites (mine/incubator/feeder/vault) + wiring"
```

---

## Task 5: BaseScreen — render buildings + readiness badge + tap-to-collect (view mode)

**Files:**
- Modify: `src/components/BaseScreen.tsx`

**Interfaces:**
- Consumes: `BUILDINGS`, `buildingById`, `isReady`, `accrued`, `BuildingState`, `collectStructure`, `EGG_SHARDS_PER_EGG` from `src/state/base.ts`; `buildingArt` from `src/base/images.ts`.
- Produces: a `buildings`/`setBuildings` + `eggShards`/`setEggShards` state pair and a building layer rendered on the board; a `BuildingIcon` component. Consumed by Task 6.

- [ ] **Step 1: Import the new symbols + add state**

At the top of `BaseScreen.tsx`, extend the `../state/base` import with (only what this task uses — `BUILDINGS` is added in Task 6):
```ts
  buildingById,
  isReady,
  collectStructure,
  BuildingState,
```
and the `../base/images` import:
```ts
import { decorArt, buildingArt } from '../base/images';
```
After the `fuel` state declaration (line ~75), add:
```ts
  const [buildings, setBuildings] = useState<Record<string, BuildingState>>(preview ? preview.buildings : {});
  const [eggShards, setEggShards] = useState<number>(preview ? preview.eggShards : 0);
  const [now, setNow] = useState<number>(() => Date.now());
```
In the `fetchBase().then(...)` callback add:
```ts
      setBuildings(b.buildings);
      setEggShards(b.eggShards);
```
Add a ticking clock so the readiness badge refreshes (after the fetch `useEffect`):
```ts
  // Re-render once a minute so readiness badges update without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
```

- [ ] **Step 2: Add a `BuildingIcon` component + a collect handler**

Below the existing `DecorIcon` component (line ~61), add:
```tsx
// Renders a building's PNG art (assets/base/<id>.png), falling back to its glyph.
const BuildingIcon: React.FC<{ id: string; size: number }> = ({ id, size }) => {
  const art = buildingArt(id);
  if (art) return <Image source={art} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Text style={{ fontSize: size * 0.78, lineHeight: size }}>{buildingById(id)?.glyph ?? '?'}</Text>;
};
```
Inside the component body, after `onRefill`, add the collect handler:
```ts
  const onCollect = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await collectStructure(id as any);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBuildings(res.value.buildings);
    setEggShards(res.value.eggShards);
    onWalletChange(res.value.tokens);
    setNow(Date.now());
  };
```

- [ ] **Step 3: Render the building layer on the board (view + edit)**

Immediately after the `validPlaced.map(...)` placed-pets block (closes ~line 239) and before the unplaced-pets block, add:
```tsx
            {/* Buildings sit on their grid cell. In view mode a ready building is
                tappable to collect and shows a badge; in edit mode taps fall
                through to the cell (placement/erase handled by the shop). */}
            {Object.entries(buildings).map(([id, st]) => {
              const def = buildingById(id);
              if (!def) return null;
              const ready = !editing && isReady(def, st, now);
              return (
                <Pressable
                  key={id}
                  pointerEvents={editing ? 'none' : 'auto'}
                  onPress={() => ready && onCollect(id)}
                  style={[styles.placedPet, { left: st.x * CELL, top: st.y * CELL }]}
                >
                  <BuildingIcon id={id} size={CELL * 0.82} />
                  {ready && (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>{def.ready}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
```

- [ ] **Step 4: Add the badge styles**

In the `StyleSheet.create({...})` block, add:
```ts
  readyBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ffd24d',
    borderRadius: 8,
    paddingHorizontal: 3,
    minWidth: 16,
    alignItems: 'center',
  },
  readyBadgeText: { fontSize: 11 },
```

- [ ] **Step 5: Typecheck + preview**

Run: `npm run typecheck` → expected exits 0.
Run: `npm run preview:base` and confirm the page loads without a crash (buildings won't appear yet until Task 6 seeds them or you build one; this step just verifies the render code compiles and mounts).

- [ ] **Step 6: Commit**

```bash
git add src/components/BaseScreen.tsx
git commit -m "Phase 2 UI: render buildings on the grid with readiness badge + tap-to-collect"
```

---

## Task 6: BaseScreen — BUILDINGS shop section (build / upgrade / place) + shards meter

**Files:**
- Modify: `src/components/BaseScreen.tsx`

**Interfaces:**
- Consumes: `buildStructure`, `upgradeStructure`, `BUILDINGS`, `buildingById` (Task 3); `buildings`/`setBuildings`, `eggShards`, `onCollect`, `BuildingIcon` (Task 5).
- Produces: placement of a selected building via the existing `onCell` tap flow.

- [ ] **Step 1: Extend imports + add build/upgrade handlers**

Add to the `../state/base` import: `BUILDINGS, buildStructure, upgradeStructure`.
After `onCollect` (Task 5), add:
```ts
  const onBuildSelect = (id: string) => {
    // Selecting an unbuilt building arms placement; the actual build happens on
    // the first tile tap (see onCell). Owned buildings can't be re-placed.
    setSelected(`build:${id}`);
  };

  const onUpgrade = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await upgradeStructure(id as any);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBuildings(res.value.buildings);
    setEggShards(res.value.eggShards);
    onWalletChange(res.value.tokens);
  };
```

- [ ] **Step 2: Handle building placement in `onCell`**

In `onCell`, after the `if (selected.startsWith('pet:')) { ... }` block and before the final `setLayout(...)`, add:
```ts
    if (selected.startsWith('build:')) {
      const type = selected.slice(6);
      if (busy) return;
      // Reject locally if the cell is taken (server also enforces this).
      if (layout.some((p) => p.x === x && p.y === y) ||
          Object.values(buildings).some((b) => b.x === x && b.y === y)) {
        setError('Cell occupied');
        return;
      }
      setBusy(true);
      setError(null);
      buildStructure(type as any, x, y).then((res) => {
        setBusy(false);
        if (!res.ok) { setError(res.error); return; }
        setBuildings(res.value.buildings);
        onWalletChange(res.value.tokens);
        setSelected(null);
      });
      return;
    }
```

- [ ] **Step 3: Add the BUILDINGS shop section + shards meter in edit mode**

In the edit-mode JSX, after the DECORATIONS `shopGrid` block (closes ~line 376), add:
```tsx
              {/* Buildings: one-of-each, upgradeable. Unbuilt → arm placement;
                  built → show level + Upgrade. */}
              <Text style={styles.shopHeader}>BUILDINGS</Text>
              {eggShards > 0 && (
                <Text style={styles.fuelText}>🥚 shards: {eggShards}/150 toward a free egg</Text>
              )}
              <View style={styles.shopGrid}>
                {BUILDINGS.map((b) => {
                  const st = buildings[b.id];
                  const active = selected === `build:${b.id}`;
                  const upCost = st ? b.upgradeCost(st.level) : null;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => (st ? undefined : onBuildSelect(b.id))}
                      style={[styles.shopCard, active && styles.shopCardActive]}
                    >
                      <BuildingIcon id={b.id} size={34} />
                      <Text style={styles.shopName} numberOfLines={1}>{b.name}</Text>
                      {!st ? (
                        <Text style={styles.shopPrice}>{active ? 'TAP TILE' : `✦ ${b.buildCost}`}</Text>
                      ) : (
                        <>
                          <Text style={styles.shopPrice}>Lv {st.level}</Text>
                          {upCost != null ? (
                            <Pressable
                              onPress={() => onUpgrade(b.id)}
                              disabled={busy || tokens < upCost}
                              style={[styles.refillBtn, (busy || tokens < upCost) && styles.refillBtnDisabled]}
                            >
                              <Text style={styles.refillBtnText}>Upgrade ({upCost})</Text>
                            </Pressable>
                          ) : (
                            <Text style={styles.fuelText}>MAX</Text>
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
```

- [ ] **Step 4: Update the placement hint for building mode**

In the `hint` `<Text>` ternary (line ~278), add a branch so it reads naturally when a build is armed. Change the chain to start with:
```tsx
                {selected?.startsWith('build:')
                  ? 'Tap an empty tile to build it here.'
                  : selected === 'erase'
```
(keep the rest of the existing chain unchanged).

- [ ] **Step 5: Typecheck + preview**

Run: `npm run typecheck` → expected exits 0.
Run: `npm run preview:base`, enter Edit mode, confirm the BUILDINGS section lists all four with build costs and (for seeded ones from Task 7) a Lv/Upgrade control. Tapping a building card then a tile should arm + show the "Tap an empty tile" hint (the build RPC no-ops against the preview's stub Supabase, which is expected — full build is verified against the live DB in Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/components/BaseScreen.tsx
git commit -m "Phase 2 UI: BUILDINGS shop section (build/upgrade/place) + shards meter"
```

---

## Task 7: Preview harness — seed buildings

**Files:**
- Modify: `src/dev/BasePreview.tsx`

**Interfaces:**
- Consumes: the `preview?: BaseState` prop (existing) — now including `buildings` + `eggShards`.

- [ ] **Step 1: Add buildings + shards to the seeded preview state**

Open `src/dev/BasePreview.tsx`. Find the `BaseState` object it passes as `preview`. Add the two new fields (use values that exercise both a ready and a not-ready state — backdate one `collectedAt`):
```ts
    buildings: {
      mine: { level: 2, x: 4, y: 0, collectedAt: Date.now() - 6 * 3600 * 1000 }, // ready
      vault: { level: 1, x: 5, y: 0, collectedAt: Date.now() },                  // not ready
    },
    eggShards: 45,
```
(If the preview state is built from `fetchBase`'s fallback shape, just ensure these two keys are present so the harness compiles and renders buildings.)

- [ ] **Step 2: Typecheck + preview**

Run: `npm run typecheck` → expected exits 0.
Run: `npm run preview:base`. Expected: the Mine shows a 💰 readiness badge at (4,0); the Vault at (5,0) shows none. Entering Edit mode shows Mine at "Lv 2" with an Upgrade(160) button and Vault at "Lv 1" Upgrade(80), and the shards meter reads "🥚 shards: 45/150".

- [ ] **Step 3: Commit**

```bash
git add src/dev/BasePreview.tsx
git commit -m "Phase 2 preview: seed buildings + shards in the base harness"
```

---

## Task 8: Egg Incubator payoff — hatch with shards

**Files:**
- Modify: `supabase/schema.sql` (the `hatch_pet` function, ~line 849)
- Modify: `src/state/usePet.ts` (the client `hatch_pet` caller)
- Modify: the hatch UI component (locate via the `hatch` call in `src/state/usePet.ts` and its caller)

**Interfaces:**
- Consumes: `egg_shards` column (Task 1), `EGG_SHARDS_PER_EGG` (Task 3).
- Produces: `hatch_pet(p_pet jsonb, p_use_shards boolean default false) → integer`; a client path that passes `p_use_shards: true` when the player chooses the free-egg option.

- [ ] **Step 1: Replace `hatch_pet` with a shard-aware version**

In `supabase/schema.sql`, replace the existing `hatch_pet(p_pet jsonb)` function. Because adding a parameter creates a new overload rather than replacing, first drop the old single-arg form, then create the two-arg form (the `default false` keeps existing one-arg client calls resolving here):
```sql
drop function if exists public.hatch_pet(jsonb);
create or replace function public.hatch_pet(p_pet jsonb, p_use_shards boolean default false)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  cost   integer := 150;          -- EGG_COST
  shards integer;
  bal    integer;
  owned  integer;
  pid    text := p_pet->>'id';
begin
  if pid is null then raise exception 'Invalid pet'; end if;
  select count(*) into owned from public.pets where owner = me;
  if owned >= public.market_max_pets() then raise exception 'Your collection is full'; end if;
  select tokens, egg_shards into bal, shards from public.profiles where id = me for update;
  if p_use_shards then
    if shards < cost then raise exception 'Not enough egg shards'; end if;
  elsif bal < cost then
    raise exception 'Not enough tokens';
  end if;
  insert into public.pets (
    id, owner, name, species, rarity, stats, level, stage,
    hunger, happiness, cleanliness, energy, health, age,
    born_at, last_tick, asleep, poops, sick, ascended
  ) values (
    pid, me, p_pet->>'name', p_pet->>'species', p_pet->>'rarity', (p_pet->'stats'),
    coalesce((p_pet->>'level')::int, 1), p_pet->>'stage',
    (p_pet->>'hunger')::real, (p_pet->>'happiness')::real,
    (p_pet->>'cleanliness')::real, (p_pet->>'energy')::real,
    (p_pet->>'health')::real, (p_pet->>'age')::real,
    (p_pet->>'bornAt')::bigint, (p_pet->>'lastTick')::bigint,
    coalesce((p_pet->>'asleep')::boolean, false),
    coalesce((p_pet->>'poops')::real, 0),
    coalesce((p_pet->>'sick')::boolean, false),
    coalesce((p_pet->>'ascended')::boolean, false)
  );
  if p_use_shards then
    update public.profiles set egg_shards = egg_shards - cost, active_pet_id = pid where id = me;
    return bal;                  -- token balance unchanged
  else
    update public.profiles set tokens = tokens - cost, active_pet_id = pid where id = me;
    return bal - cost;
  end if;
end; $$;
grant execute on function public.hatch_pet(jsonb, boolean) to authenticated;
```

- [ ] **Step 2: Apply + verify the shard path**

Paste into the Supabase SQL Editor and run. Then verify:
```sql
update public.profiles set egg_shards = 150 where id = auth.uid();
select public.hatch_pet('{"id":"test-shard-1","name":"Shardy","species":"cat","rarity":"common","stats":{"attack":1,"defense":1,"speed":1,"maxHp":10},"stage":"egg","hunger":100,"happiness":100,"cleanliness":100,"energy":100,"health":100,"age":0,"bornAt":0,"lastTick":0}'::jsonb, true);
select tokens, egg_shards from public.profiles where id = auth.uid();  -- egg_shards back to 0, tokens unchanged
delete from public.pets where id = 'test-shard-1';
```
Expected: hatch succeeds, `egg_shards` = 0, `tokens` unchanged.

- [ ] **Step 3: Surface the option in the client**

In `src/state/usePet.ts`, find the `supabase.rpc('hatch_pet', { p_pet: ... })` call. Add an optional `useShards` parameter threaded from the UI:
```ts
// in the hatch function signature, add a param (default false):
//   const hatch = async (..., useShards = false) => {
// and pass it to the rpc:
    const { data, error } = await supabase.rpc('hatch_pet', { p_pet: petPayload, p_use_shards: useShards });
```
Expose the player's `eggShards` to the hatch UI (read it from `fetchBase()` or wherever profile/wallet state is hydrated), and in the hatch screen render a secondary button when `eggShards >= EGG_SHARDS_PER_EGG`:
```tsx
{eggShards >= EGG_SHARDS_PER_EGG && (
  <Pressable onPress={() => hatch(/* …pet… */, true)} style={styles.shardHatchBtn}>
    <Text style={styles.shardHatchText}>🥚 Hatch with shards (free)</Text>
  </Pressable>
)}
```
(Match the surrounding component's prop-passing and style conventions; import `EGG_SHARDS_PER_EGG` from `../state/base`.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/state/usePet.ts src/  # plus the hatch UI file you edited
git commit -m "Phase 2: Egg Incubator payoff — hatch with shards (150 = 1 free egg)"
```

---

## Task 9: Verification doc

**Files:**
- Create: `docs/verification-habitat-phase2.md`

- [ ] **Step 1: Write a verification doc mirroring `docs/verification-pr90.md`**

Document, with the exact SQL from Tasks 2 and 8 and their observed results: build deducts the cost; immediate collect rejects; backdated collect yields the capped amount; duplicate build / off-grid / occupied-cell / not-enough-tokens all reject; vault "Not ready" before cooldown; feeder tops up pets; upgrade banks pending then bumps level; hatch-with-shards consumes 150 shards and leaves tokens unchanged. Note the typecheck pass and a screenshot/description from `npm run preview:base`.

- [ ] **Step 2: Commit**

```bash
git add docs/verification-habitat-phase2.md
git commit -m "Phase 2: verification doc (RPC behavior + typecheck + preview)"
```

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), 4 buildings + balancing constants (Tasks 1, 3), build/upgrade/collect RPCs with server-side `now()` math + atomic deduction (Task 2), `save_base_layout` overlap guard (Task 2), client catalog + wrappers (Task 3), custom Sprite-AI art (Task 4), grid render + readiness + tap-collect (Task 5), edit-mode build/upgrade UI + shards meter (Task 6), preview harness (Task 7), egg-shard hatch payoff (Task 8), verification doc (Task 9). All spec sections map to a task.
- **Type consistency:** `BuildingState { level, x, y, collectedAt }` and `Record<string, BuildingState>` used consistently across `base.ts`, `BaseScreen.tsx`, and the preview. RPC return keys (`tokens`, `egg_shards`, `base_buildings`, `yield`) match between the SQL `jsonb_build_object` and the client wrappers. `BuildingId` literal union used for `buildStructure`/`upgradeStructure`/`collectStructure` (cast at call sites where the id is a generic string).
- **No JS unit tests** because the repo has none; verification is typecheck + manual SQL + preview harness, consistent with how Phase 1 / PR #90 shipped.

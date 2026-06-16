# Functional Decorations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make four base decorations (Food Bowl, Toy Ball, Pet Bed, Pond) functional — while placed and fueled, each slows one care stat's real-time decay by 40% for all the owner's pets, with token-refilled 48h fuel reservoirs.

**Architecture:** All decay logic stays server-authoritative. A new server-owned `profiles.base_fuel` jsonb tracks per-type fuel expiry (epoch millis). `_base_care_mult(owner)` derives per-stat decay multipliers from what's placed + fueled; `_decay_pet_row` gains an optional multiplier param that both its callers (`care_action`, `start_battle`) pass. The client gains a refill RPC wrapper and a fuel gauge in the habitat shop drawer.

**Tech Stack:** Supabase Postgres (plpgsql RPCs, applied via the Supabase MCP server, project ref `iohinzflwtriddnrxein`), React Native + Expo + TypeScript client.

**Testing reality (read first):** This repo has **no unit-test runner** — `package.json` has only `typecheck` (`tsc --noEmit`). Established practice (see PR #124/#125) is: apply schema changes live via the Supabase MCP, verify RPCs with **SQL self-tests wrapped in a transaction + `rollback`**, then gate the client with `npm run typecheck` and a manual in-app smoke test. This plan follows that — it does **not** introduce jest/pgTAP (out of scope, large YAGNI detour). SQL self-tests below use a `:test_uid` placeholder: substitute the uuid of a throwaway/dev auth user (`select id from auth.users limit 1;` or your own test account) where shown.

**Source of truth:** the server (`supabase/schema.sql`) owns prices, fuel, and decay math; client constants in `src/state/base.ts` mirror it. The whole feature lives behind cloud mode — when Supabase is not configured the habitat already falls back gracefully and these RPCs are simply never called.

---

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `supabase/schema.sql` | `base_fuel` column, catalog/balance helpers, `unlock_decor` (amend), `refill_decor` (new), `_base_care_mult` (new), `_decay_pet_row` (amend), `care_action` + `start_battle` (wire multiplier) | Modify |
| `src/state/base.ts` | `FUNCTIONAL_DECOR` map, balance constants, `BaseState.fuel`, `fetchBase` (fuel), `refillDecor()` wrapper | Modify |
| `src/components/BaseScreen.tsx` | Fuel gauge + Refill button in the shop drawer; load/refresh fuel | Modify |
| `docs/functional-decorations-spec.md` | The approved spec (already committed) | Reference |

All schema additions go in the **Base / Habitat** region of `schema.sql` (around the existing `_decor_price` / `unlock_decor` / `save_base_layout` block, lines ~452–560). Re-running the whole file must stay idempotent.

---

## Task 1: Schema — `base_fuel` column + catalog/balance helpers

**Files:**
- Modify: `supabase/schema.sql` (Base/Habitat region, after the `_decor_price` function, ~line 477)

- [ ] **Step 1: Add the column + helper functions**

Insert immediately after the `_decor_price(...)` function (after its closing `$$;`):

```sql
-- Functional-decoration support: a server-owned fuel reservoir per functional
-- item type. base_fuel maps id → filled_until (epoch ms); while now < that
-- value the item (if also placed) slows its mapped stat's decay. NOT writable
-- via save_base_layout — only unlock_decor (free first fill) and refill_decor.
alter table public.profiles
  add column if not exists base_fuel jsonb not null default '{}';

-- Which care stat a decoration slows the decay of (null = purely cosmetic).
-- Keep in sync with FUNCTIONAL_DECOR in src/state/base.ts.
create or replace function public._decor_functional_stat(p_id text)
returns text language sql immutable as $$
  select case p_id
    when 'bowl' then 'hunger'
    when 'ball' then 'happiness'
    when 'bed'  then 'energy'
    when 'pond' then 'cleanliness'
    else null
  end;
$$;

-- Balance constants (mirror src/state/base.ts).
create or replace function public._decor_fuel_ms() returns bigint
  language sql immutable as $$ select (48 * 3600 * 1000)::bigint $$;   -- 48h fill
create or replace function public._decor_refill_cost() returns integer
  language sql immutable as $$ select 15 $$;                          -- tokens
create or replace function public._decor_decay_mult() returns double precision
  language sql immutable as $$ select 0.6 $$;                         -- fueled → 40% slower
```

- [ ] **Step 2: Apply via the Supabase MCP**

Use the Supabase MCP `apply_migration` tool (name: `functional_decor_column_helpers`) with the SQL from Step 1. Expected: success, no error.

- [ ] **Step 3: Verify the column + helpers exist**

Run via Supabase MCP `execute_sql`:

```sql
select
  public._decor_functional_stat('bowl')  as bowl_stat,   -- hunger
  public._decor_functional_stat('pond')  as pond_stat,   -- cleanliness
  public._decor_functional_stat('tree')  as tree_stat,   -- null
  public._decor_fuel_ms()                 as fuel_ms,      -- 172800000
  public._decor_refill_cost()             as refill_cost,  -- 15
  public._decor_decay_mult()              as mult;         -- 0.6
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'base_fuel';
```

Expected: first row `hunger | cleanliness | null | 172800000 | 15 | 0.6`; second query returns one row `base_fuel`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Functional decor: add base_fuel column + catalog/balance helpers"
```

---

## Task 2: Schema — `unlock_decor` grants the free first fill

**Files:**
- Modify: `supabase/schema.sql` — `unlock_decor` (~lines 481–500)

- [ ] **Step 1: Amend the function's UPDATE to seed fuel for functional items**

Replace the existing `update public.profiles … returning tokens, base_decor_owned into bal, owned;` block inside `unlock_decor` with:

```sql
  update public.profiles
    set tokens = tokens - price,
        base_decor_owned = array_append(base_decor_owned, p_id),
        base_fuel = case
          when public._decor_functional_stat(p_id) is not null then
            jsonb_set(
              base_fuel, array[p_id],
              to_jsonb(((extract(epoch from now()) * 1000)::bigint + public._decor_fuel_ms()))
            )
          else base_fuel
        end
    where id = me
    returning tokens, base_decor_owned into bal, owned;
```

Leave the rest of `unlock_decor` unchanged (it still returns `{ tokens, owned }`).

- [ ] **Step 2: Apply via Supabase MCP**

`apply_migration` name `unlock_decor_first_fill` with the full amended `create or replace function public.unlock_decor(...)` (copy the whole function from `schema.sql`, including the changed UPDATE). Expected: success.

- [ ] **Step 3: Verify first fill is granted (transaction + rollback)**

Run via `execute_sql` (substitute `:test_uid`):

```sql
begin;
-- ensure the test profile doesn't already own a bowl, give it tokens
update public.profiles
  set base_decor_owned = array_remove(base_decor_owned, 'bowl'),
      base_fuel = base_fuel - 'bowl',
      tokens = 1000
  where id = ':test_uid';
-- impersonate the user so auth.uid() resolves inside the SECURITY DEFINER fn
set local role authenticated;
set local "request.jwt.claims" = '{"sub":":test_uid","role":"authenticated"}';
select public.unlock_decor('bowl');
reset role;
select (base_fuel->>'bowl')::bigint - (extract(epoch from now())*1000)::bigint as ms_left
  from public.profiles where id = ':test_uid';
rollback;
```

Expected: `unlock_decor` returns JSON containing `"owned"` with `bowl`; `ms_left` is close to `172800000` (≈48h, positive). `rollback` discards the seed.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Functional decor: unlock_decor grants the free first fill"
```

---

## Task 3: Schema — `refill_decor` RPC

**Files:**
- Modify: `supabase/schema.sql` — add after `unlock_decor` (before `save_base_layout`)

- [ ] **Step 1: Add the RPC**

```sql
-- Refill a functional decoration's fuel to a full 48h for a flat token cost.
-- Server-validated: must be an owned functional item, and the player must have
-- the tokens. Sets (not extends) filled_until to now + 48h. Returns the new
-- wallet + full fuel map.
create or replace function public.refill_decor(p_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  cost   integer := public._decor_refill_cost();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  bal    integer;
  owned  text[];
  fuel   jsonb;
begin
  if public._decor_functional_stat(p_id) is null then
    raise exception 'Not a functional item';
  end if;
  select tokens, base_decor_owned into bal, owned
    from public.profiles where id = me for update;
  if not (p_id = any(owned)) then raise exception 'You do not own that'; end if;
  if bal < cost then raise exception 'Not enough tokens'; end if;
  update public.profiles
    set tokens = tokens - cost,
        base_fuel = jsonb_set(base_fuel, array[p_id], to_jsonb(now_ms + public._decor_fuel_ms()))
    where id = me
    returning tokens, base_fuel into bal, fuel;
  return jsonb_build_object('tokens', bal, 'base_fuel', fuel);
end; $$;
grant execute on function public.refill_decor(text) to authenticated;
```

- [ ] **Step 2: Apply via Supabase MCP**

`apply_migration` name `refill_decor_rpc` with the Step 1 SQL. Expected: success.

- [ ] **Step 3: Verify charge + refill, and the rejections (transaction + rollback)**

```sql
begin;
update public.profiles
  set base_decor_owned = array_append(array_remove(base_decor_owned, 'ball'), 'ball'),
      base_fuel = base_fuel - 'ball',
      tokens = 100
  where id = ':test_uid';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":":test_uid","role":"authenticated"}';
-- happy path: charges 15, fuels ball
select public.refill_decor('ball');
-- rejection: not a functional item
do $$ begin
  begin perform public.refill_decor('tree'); raise exception 'should have failed';
  exception when others then raise notice 'tree rejected: %', sqlerrm; end;
end $$;
reset role;
select tokens, (base_fuel->>'ball')::bigint - (extract(epoch from now())*1000)::bigint as ms_left
  from public.profiles where id = ':test_uid';
rollback;
```

Expected: first call returns JSON with `tokens` = 85 and a `base_fuel` containing `ball`; a `NOTICE` "tree rejected: Not a functional item"; final row shows `tokens = 85` and `ms_left ≈ 172800000`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Functional decor: add refill_decor RPC"
```

---

## Task 4: Schema — `_base_care_mult` helper

**Files:**
- Modify: `supabase/schema.sql` — add after `refill_decor`

- [ ] **Step 1: Add the helper**

```sql
-- Per-stat decay multipliers for an owner's pets, derived from the base:
-- a functional item that is BOTH placed (present in base_layout) AND fueled
-- (now < base_fuel[id]) slows its stat to _decor_decay_mult(); all other stats
-- stay at 1 (full decay). No auth — called by SECURITY DEFINER care RPCs only.
create or replace function public._base_care_mult(p_owner uuid)
returns jsonb
language plpgsql stable as $$
declare
  layout jsonb;
  fuel   jsonb;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  mult   jsonb := '{"hunger":1,"happiness":1,"cleanliness":1,"energy":1}'::jsonb;
  stat   text;
  did    text;
begin
  select base_layout, base_fuel into layout, fuel
    from public.profiles where id = p_owner;
  if layout is null then return mult; end if;
  for did in
    select distinct (item->>'id') from jsonb_array_elements(layout) as item
  loop
    stat := public._decor_functional_stat(did);
    if stat is not null and coalesce((fuel->>did)::bigint, 0) > now_ms then
      mult := jsonb_set(mult, array[stat], to_jsonb(public._decor_decay_mult()));
    end if;
  end loop;
  return mult;
end; $$;
revoke execute on function public._base_care_mult(uuid) from public, anon, authenticated;
```

- [ ] **Step 2: Apply via Supabase MCP**

`apply_migration` name `base_care_mult_helper`. Expected: success.

- [ ] **Step 3: Verify the placed-AND-fueled logic (transaction + rollback)**

```sql
begin;
-- bowl placed + fueled (future) → hunger 0.6; ball owned+fueled but NOT placed → happiness stays 1;
-- pond placed but EMPTY (past) → cleanliness stays 1.
update public.profiles
  set base_layout = '[{"id":"bowl","x":0,"y":0},{"id":"pond","x":1,"y":0},{"id":"tree","x":2,"y":0}]'::jsonb,
      base_fuel = jsonb_build_object(
        'bowl', (extract(epoch from now())*1000)::bigint + 100000,
        'ball', (extract(epoch from now())*1000)::bigint + 100000,
        'pond', (extract(epoch from now())*1000)::bigint - 100000)
  where id = ':test_uid';
select public._base_care_mult(':test_uid');
rollback;
```

Expected JSON: `{"hunger":0.6, "happiness":1, "cleanliness":1, "energy":1}` (bowl placed+fueled → 0.6; ball fueled but not placed → 1; pond placed but expired → 1).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Functional decor: add _base_care_mult decay-multiplier helper"
```

---

## Task 5: Schema — `_decay_pet_row` multiplier param + wire both callers

**Files:**
- Modify: `supabase/schema.sql` — `_decay_pet_row` (~1074–1123), `care_action` (~1129), `start_battle` (~1252)

- [ ] **Step 1: Drop the old one-arg signature, recreate with the multiplier**

Adding a defaulted param creates a NEW signature `(public.pets, jsonb)` rather than replacing `(public.pets)` — so the one-arg orphan must be dropped first (same lesson as PR #125's `save_base_layout`). Replace the existing `_decay_pet_row` definition and its `revoke` line with:

```sql
drop function if exists public._decay_pet_row(public.pets);
create or replace function public._decay_pet_row(pet public.pets, p_mult jsonb default '{}')
returns public.pets
language plpgsql as $$
declare
  now_ms    bigint := (extract(epoch from now()) * 1000)::bigint;
  raw       double precision := greatest(0, (now_ms - pet.last_tick) / 1000.0);
  scaled    double precision;
  sm        double precision := case when pet.asleep then 0.25 else 1 end;
  hd        double precision := 0;
  m_hun     double precision := coalesce((p_mult->>'hunger')::double precision, 1);
  m_hap     double precision := coalesce((p_mult->>'happiness')::double precision, 1);
  m_cln     double precision := coalesce((p_mult->>'cleanliness')::double precision, 1);
  m_enr     double precision := coalesce((p_mult->>'energy')::double precision, 1);
begin
  if pet.stage = 'dead' or raw < 0.5 then return pet; end if;
  -- offline scaling: real time up to 30s, then 10% (scaleElapsed)
  scaled := case when raw <= 30 then raw else 30 + (raw - 30) * 0.1 end;

  pet.age := pet.age + raw;
  pet.stage := case
    when pet.age < 30     then 'egg'
    when pet.age < 86400  then 'baby'
    when pet.age < 172800 then 'child'
    when pet.age < 259200 then 'teen'
    else 'adult' end;
  if pet.stage = 'egg' then pet.last_tick := now_ms; return pet; end if;

  pet.hunger      := greatest(0, least(100, pet.hunger      - scaled * 0.01  * sm * m_hun));
  pet.happiness   := greatest(0, least(100, pet.happiness   - scaled * 0.008 * sm * m_hap));
  pet.cleanliness := greatest(0, least(100, pet.cleanliness - scaled * 0.005 * m_cln));
  pet.energy := case when pet.asleep
    then least(100, pet.energy + scaled * 0.2)
    else greatest(0, pet.energy - scaled * 0.007 * m_enr) end;

  if not pet.asleep then pet.poops := least(pet.poops + scaled / 3600.0, 8); end if;
  if floor(pet.poops) >= 2 and not pet.sick
     and random() < (1 - exp(-scaled * 0.0002)) then
    pet.sick := true;
  end if;

  if pet.hunger      <= 0 then hd := hd - scaled * 0.012; end if;
  if pet.happiness   <= 0 then hd := hd - scaled * 0.006; end if;
  if pet.cleanliness <= 0 then hd := hd - scaled * 0.005; end if;
  if pet.sick             then hd := hd - scaled * 0.008; end if;
  if pet.hunger > 60 and pet.happiness > 60 and pet.cleanliness > 60 and not pet.sick then
    hd := hd + scaled * 0.003;
  end if;
  pet.health := greatest(0, least(100, pet.health + hd));
  if pet.health <= 0 then pet.stage := 'dead'; pet.asleep := false; end if;

  pet.last_tick := now_ms;
  return pet;
end; $$;
revoke execute on function public._decay_pet_row(public.pets, jsonb) from public, anon, authenticated;
```

> Note: energy regen while asleep (`+ scaled * 0.2`) is intentionally NOT multiplied — the Pet Bed slows the *awake* energy drain only (per spec). Health is derived and unmultiplied; it benefits indirectly via the higher hunger/happiness/cleanliness thresholds above.

- [ ] **Step 2: Wire `care_action` to compute + pass the multiplier**

In `care_action`, add to the `declare` block:

```sql
  mult   jsonb;
```

Then replace the line `pet := public._decay_pet_row(pet);  -- bring care state current` with:

```sql
  mult := public._base_care_mult(me);
  pet := public._decay_pet_row(pet, mult);  -- bring care state current (base-bonus aware)
```

- [ ] **Step 3: Wire `start_battle` to pass the multiplier too**

In `start_battle`, the `declare` block already has `me uuid := auth.uid();`. Add:

```sql
  mult jsonb;
```

Then replace its `pet := public._decay_pet_row(pet);` (the line right after the "Bring care current" comment, ~1252) with:

```sql
  mult := public._base_care_mult(me);
  pet := public._decay_pet_row(pet, mult);
```

- [ ] **Step 4: Apply all three via Supabase MCP**

`apply_migration` name `decay_pet_row_multiplier` containing: the `drop` + recreated `_decay_pet_row` + revoke (Step 1), the full amended `create or replace function public.care_action(...)` (Step 2), and the full amended `create or replace function public.start_battle(...)` (Step 3). Copy the complete current function bodies from `schema.sql` with the edits applied. Expected: success.

- [ ] **Step 5: Verify the multiplier slows decay (transaction + rollback)**

Compares the same pet decayed with full vs. multiplied hunger over a simulated 100s gap. Substitute a real pet id owned by `:test_uid` (`select id from public.pets where owner=':test_uid' and stage not in ('egg','dead') limit 1;`):

```sql
begin;
-- force a 100s decay gap and a known starting hunger
update public.pets set last_tick = (extract(epoch from now())*1000)::bigint - 100000,
                       hunger = 100, asleep = false
  where id = ':test_pet_id';
select
  (public._decay_pet_row(p.*)).hunger                         as hunger_full,    -- ~99.0 (−1.0)
  (public._decay_pet_row(p.*, '{"hunger":0.6}'::jsonb)).hunger as hunger_fueled   -- ~99.4 (−0.6)
from public.pets p where p.id = ':test_pet_id';
rollback;
```

Expected: `hunger_fueled` > `hunger_full` (decayed ~0.6 vs ~1.0 over 100s). `rollback` restores the pet.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql
git commit -m "Functional decor: thread base-care multiplier through decay + both callers"
```

---

## Task 6: Client — `src/state/base.ts` state + refill wrapper

**Files:**
- Modify: `src/state/base.ts`

- [ ] **Step 1: Add functional metadata + balance constants**

After the `DecorDef` type (line ~20) and `BASE_DECOR` list, add:

```ts
// Care stats a functional decoration can slow the decay of. Mirrors
// _decor_functional_stat in supabase/schema.sql.
export type CareStat = 'hunger' | 'happiness' | 'cleanliness' | 'energy';

// Functional decorations: id → the stat it slows while placed + fueled.
// Mirrors _decor_functional_stat in supabase/schema.sql (server is source of truth).
export const FUNCTIONAL_DECOR: Record<string, CareStat> = {
  bowl: 'hunger',
  ball: 'happiness',
  bed: 'energy',
  pond: 'cleanliness',
};

// Balance constants — mirror _decor_fuel_ms / _decor_refill_cost / _decor_decay_mult.
export const FUEL_FILL_MS = 48 * 3600 * 1000; // a full reservoir = 48h
export const REFILL_COST = 15;                // tokens to refill to full
export const DECAY_MULT = 0.6;                // fueled item → 40% slower decay

export const functionalStat = (id: string): CareStat | undefined =>
  FUNCTIONAL_DECOR[id];
```

- [ ] **Step 2: Add `fuel` to `BaseState` and load it in `fetchBase`**

Change the `BaseState` type to add `fuel`:

```ts
export type BaseState = {
  owned: string[];
  layout: Placed[];
  pets: PlacedPet[];
  floor: string;
  fuel: Record<string, number>; // decor id → filled_until (epoch ms)
};
```

In `fetchBase`, change the fallback and the select + return to include `base_fuel`:

```ts
  const fallback: BaseState = { owned: [], layout: [], pets: [], floor: 'grass', fuel: {} };
```

```ts
    .select('base_decor_owned, base_layout, base_pets, base_floor, base_fuel')
```

```ts
  return {
    owned: (d.base_decor_owned as string[]) ?? [],
    layout: (d.base_layout as Placed[]) ?? [],
    pets: (d.base_pets as PlacedPet[]) ?? [],
    floor: (d.base_floor as string) ?? 'grass',
    fuel: (d.base_fuel as Record<string, number>) ?? {},
  };
```

- [ ] **Step 3: Add the `refillDecor` wrapper**

After `unlockDecor` (line ~99), add:

```ts
// Refill a functional decoration's fuel to full; server charges REFILL_COST.
export const refillDecor = async (
  id: string
): Promise<Result<{ tokens: number; fuel: Record<string, number> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('refill_decor', { p_id: id });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ok: true,
    value: { tokens: Number(d.tokens), fuel: (d.base_fuel as Record<string, number>) ?? {} },
  };
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/state/base.ts
git commit -m "Functional decor: client state, constants, and refillDecor wrapper"
```

---

## Task 7: Client — `BaseScreen.tsx` fuel gauge + refill button

**Files:**
- Modify: `src/components/BaseScreen.tsx`

- [ ] **Step 1: Import the new symbols + add fuel state**

Add to the existing import from `../state/base`:

```ts
  refillDecor,
  functionalStat,
  REFILL_COST,
  FUEL_FILL_MS,
```

Add a state hook alongside the others (near `const [owned, setOwned] = ...`):

```ts
  const [fuel, setFuel] = useState<Record<string, number>>({});
```

In the `fetchBase().then(...)` effect body, after `setOwned(b.owned);` add:

```ts
      setFuel(b.fuel);
```

- [ ] **Step 2: Add a refill handler + a fuel-label helper**

Add inside the component, near the other handlers (e.g. after `onCell`):

```ts
  const fuelLabel = (id: string): string => {
    const until = fuel[id] ?? 0;
    const msLeft = until - Date.now();
    if (msLeft <= 0) return 'Empty';
    const hrs = Math.ceil(msLeft / 3600000);
    return `Fueled · ${hrs}h left`;
  };

  const onRefill = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await refillDecor(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFuel(res.value.fuel);
    onWalletChange(res.value.tokens);
  };
```

> `onWalletChange` is the existing prop used after `unlockDecor`; reuse it so the wallet header stays in sync. Confirm its exact name/signature against the current file and match it.

- [ ] **Step 3: Render the gauge + Refill button on functional items in the shop drawer**

In the decor shop row where each `BASE_DECOR` item card is rendered (the block using `d.glyph` / `styles.shopGlyph`, ~line 300), add — inside the card, for functional + owned items — the fuel line and a refill button. Insert after the price/owned line of the card:

```tsx
                      {functionalStat(d.id) && owned?.includes(d.id) && (
                        <>
                          <Text style={styles.fuelText}>{fuelLabel(d.id)}</Text>
                          <Pressable
                            onPress={() => onRefill(d.id)}
                            disabled={busy || tokens < REFILL_COST}
                            style={[
                              styles.refillBtn,
                              (busy || tokens < REFILL_COST) && styles.refillBtnDisabled,
                            ]}
                          >
                            <Text style={styles.refillBtnText}>Refill ({REFILL_COST})</Text>
                          </Pressable>
                        </>
                      )}
```

> Match `owned` / `tokens` / `busy` to the variables already in scope in this component (they are used by the existing unlock flow). If `owned` is typed `string[] | null`, the `owned?.includes` guard above already handles null.

- [ ] **Step 4: Add the styles**

In the `StyleSheet.create({...})` block, add:

```ts
  fuelText: { color: '#cfe3ef', fontSize: 10, marginTop: 2 },
  refillBtn: {
    backgroundColor: '#3a7d4f',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 3,
  },
  refillBtnDisabled: { opacity: 0.5 },
  refillBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BaseScreen.tsx
git commit -m "Functional decor: fuel gauge + refill button in the habitat shop"
```

---

## Task 8: End-to-end smoke test + PR

**Files:** none (verification + ship)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Manual in-app smoke (web)**

Run: `npm run web` (with Supabase env vars set so cloud mode is on). Log in as a test account, then:
1. Open the 🏡 Habitat → Edit. Buy a Food Bowl if not owned — confirm it shows "Fueled · 48h left".
2. Place the bowl on the grid, Save.
3. Confirm the **Refill (15)** button charges 15 tokens (wallet header drops) and the gauge stays/returns to ~48h.
4. Confirm a cosmetic item (e.g. Tree) shows **no** fuel line / refill button.
5. Sanity: with the bowl placed + fueled, a pet's hunger should drain visibly slower than an identical pet with no bowl (optional/slow to observe — the SQL test in Task 5 already proved the math).

Expected: all five behave as described; no console errors.

- [ ] **Step 3: Push the branch and open a PR**

```bash
git push -u origin claude/functional-decorations
gh pr create --title "Functional decorations: bowl/ball/bed/pond slow care decay" \
  --body "Implements docs/functional-decorations-spec.md. Functional base decorations slow one care stat's decay 40% base-wide while placed + fueled; 48h reservoirs refilled for 15 tokens (first fill free on purchase). All decay logic stays server-authoritative. Schema applied live + SQL self-tested; tsc clean."
```

Expected: PR created.

---

## Self-review notes (already reconciled)

- **Spec coverage:** binary per-stat effect (Task 4/5), `base_fuel` server-owned column not in `save_base_layout` (Task 1), free first fill on purchase (Task 2), `refill_decor` 15-token top-up (Task 3), `_base_care_mult` placed-AND-fueled rule (Task 4), `_decay_pet_row` optional multiplier + both callers wired (Task 5), client `FUNCTIONAL_DECOR`/`fuel`/`refillDecor` (Task 6), fuel gauge + Refill UI (Task 7). All spec sections map to a task.
- **Type/name consistency:** `base_fuel` (column), `_decor_functional_stat` / `_decor_fuel_ms` / `_decor_refill_cost` / `_decor_decay_mult` (helpers), `refill_decor` / `_base_care_mult` (RPCs), `FUNCTIONAL_DECOR` / `FUEL_FILL_MS` / `REFILL_COST` / `DECAY_MULT` / `functionalStat` / `refillDecor` (client) used identically across tasks.
- **Overload hygiene:** Task 5 drops the old one-arg `_decay_pet_row(public.pets)` before recreating, and revokes the new `(public.pets, jsonb)` signature — avoids the orphan-overload class of bug fixed in PR #125.
- **Both decay callers covered:** `care_action` (Task 5 Step 2) and `start_battle` (Task 5 Step 3).
```

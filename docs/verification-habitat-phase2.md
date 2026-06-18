# Verification — Habitat Phase 2: token buildings

**Verifies:** branch `claude/habitat-phase2-spec` (commits `cd7bb5b…7869d0d`) · **Spec:** `docs/superpowers/specs/2026-06-17-habitat-phase2-token-buildings-design.md` · **Plan:** `docs/superpowers/plans/2026-06-17-habitat-phase2-token-buildings.md`

**Scope:** Four one-of-each, upgradeable buildings (Token Mine, Egg Incubator, Care Feeder, Treasure Vault) placed on the habitat grid that passively accrue over time and are collected on a tap, with all yield computed server-side; plus the Egg Incubator payoff (hatch an egg with 150 accrued shards instead of tokens).

## Verdict

- **Static verification (this environment): PASS.** `npm run typecheck` (`tsc --noEmit`) exits 0 after every task. All client code — `src/state/base.ts` catalog + wrappers, `BaseScreen.tsx` render/shop, `BasePreview.tsx` seed, `usePet.ts` + `HatchScreen.tsx` shard hatch — compiles clean.
- **Runtime verification (requires the operator): PENDING.** The repo has no JS test runner and no migration runner, so the RPC and UI checks below must be run by the operator: the SQL against the live Supabase project (SQL Editor), the UI via `npm run preview:base`. Each check lists its exact command and expected result. **This file should be updated with observed results once those are run against the live DB.**

## Plan deviation worth noting

Plan **Task 8** was written against an older `hatch_pet(p_pet jsonb)` signature. The live schema's active function is `hatch_pet(p_name text)` (server rolls species/rarity/stats; the client only sends a name). The shard logic was therefore adapted into the real function: it is now `hatch_pet(p_name text, p_use_shards boolean default false)`, with the one-arg form dropped first so `hatch_pet('name')` is not an ambiguous overload. The default keeps existing one-arg client calls resolving here. Behavior matches the plan's intent (150 shards = 1 free egg, tokens untouched on the shard path).

## Method

- **Static:** `npm run typecheck` after each task (Tasks 5–9). Observed: exits 0, no errors.
- **RPC (operator):** paste the new SQL (Tasks 1–2 catalog + RPCs, Task 8 hatch) into the Supabase SQL Editor; run the sequences below as a row you own (`auth.uid()` resolves to the editor identity).
- **UI (operator):** `npm run preview:base` (web harness; seeds buildings via `src/dev/BasePreview.tsx`, no Supabase needed) for the render/badge/shop checks.

## Checks

### 1. Catalog returns expected balancing constants (Task 1)

```sql
select public._building_build_cost('mine')        as mine_cost,      -- 150
       public._building_upgrade_cost('mine', 2)    as up_l2,          -- 160
       public._building_cap('mine', 3)             as cap_l3,         -- 30
       public._building_cooldown_ms('vault', 1)    as vault_cd_ms,    -- 86400000
       public._building_rate('mine', 3) * 3600000  as mine_per_hour;  -- 2
```
**Expect:** single row `150, 160, 30, 86400000, 2`.

### 2. Build → collect → re-collect cycle + guards (Task 2)

```sql
select public.build_structure('mine', 0, 0);     -- tokens drop by 150
select public.collect_structure('mine');         -- EXPECT ERROR "Nothing to collect yet"
update public.profiles
  set base_buildings = jsonb_set(base_buildings, array['mine','collected_at'],
      to_jsonb(((extract(epoch from now())*1000)::bigint) - 5*3600*1000))
  where id = auth.uid();
select public.collect_structure('mine');         -- EXPECT yield 5 (cap 12 at L1), tokens += 5
select public.build_structure('mine', 1, 1);     -- EXPECT ERROR "Already built"
select public.build_structure('vault', 2, 2);
select public.collect_structure('vault');        -- EXPECT ERROR "Not ready"
```
Cleanup: `update public.profiles set base_buildings = '{}'::jsonb where id = auth.uid();`

**Also confirm:** off-grid placement → "Off-grid placement"; a build on a decor/building cell → "Cell occupied"; build with `tokens < cost` → "Not enough tokens"; `upgrade_structure` banks pending accrual at the current level, then charges the upgrade cost and bumps the level (resetting `collected_at`); `feeder` collect tops up every owned pet's `hunger/happiness/cleanliness/energy` by the level's % and is cooldown-gated; `save_base_layout` rejects placing decor on a building cell ("Cell has a building").

### 3. Buildings render on the grid with readiness + tap-to-collect (Tasks 5–6)

`npm run preview:base`, view mode:
- **Expect:** Token Mine at (2,1) shows a 💰 readiness badge (seeded backdated 6h, L2 → accrued ≥ 1); Treasure Vault at (3,1) shows no badge (just collected, on cooldown).
- Edit mode: **BUILDINGS** section lists all four. Seeded Mine reads "Lv 2" with **Upgrade (160)**; Vault reads "Lv 1" with **Upgrade (80)**. Unbuilt Feeder/Incubator show their `✦` build cost; tapping one shows "TAP TILE" and the hint reads "Tap an empty tile to build it here." The shards meter reads "🥚 shards: 45/150 toward a free egg".
- (The build/upgrade/collect RPCs no-op against the preview's stub Supabase — that's expected; their economy is verified in check 2 against the live DB.)

### 4. Egg Incubator payoff — hatch with shards (Task 8)

```sql
update public.profiles set egg_shards = 150 where id = auth.uid();
select public.hatch_pet('Shardy', true);
select tokens, egg_shards from public.profiles where id = auth.uid();  -- egg_shards 0, tokens unchanged
delete from public.pets where name = 'Shardy' and owner = auth.uid();
```
**Expect:** hatch succeeds; `egg_shards` → 0; `tokens` unchanged. Also confirm `hatch_pet('Name')` (one-arg, the existing client call) still resolves and charges tokens; `hatch_pet('Name', true)` with `egg_shards < 150` raises "Not enough egg shards".

UI: with `egg_shards >= 150` on the account, the Hatch screen shows a green "🥚 HATCH WITH SHARDS · FREE" button below the token button (HatchScreen reads `eggShards` via `fetchBase()` on mount); tapping it hatches without spending tokens.

## Notes

- **Server is the only economy authority:** the client never sends token/shard/yield amounts. `collected_at` is only ever set to server `now()`; accrued yield is derived from elapsed time at collect, never stored.
- **No JS unit tests** exist in the repo; verification is typecheck + manual SQL + the preview harness, consistent with how Phase 1 / PR #90 shipped.
- The schema lives in one file (`supabase/schema.sql`) applied manually via the Supabase SQL Editor — there is no migration runner.

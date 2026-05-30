# Verification — PR #90: server-authoritative pet care (Phase 2a)

**Verifies:** [PR #90](https://github.com/stevenspiegel/pixelpets/pull/90) · **Branch:** `claude/server-care-phase2a` · **Commit:** `f046240` · **File changed:** `src/state/usePet.ts` (+37 / −35)

**Verdict: PASS** — all four requested checks confirmed by driving the running web app against a live Supabase backend (Chrome DevTools automation), observing network + server state directly.

## What the PR claims

The debounced cloud sync stops writing per-pet care columns and writes only `profiles.active_pet_id`; the decay-tick interval persists the active pet via `care_action('tick')`; and `renamePet` writes the `name` column directly to `pets`. All care state is server-owned through the `care_action` RPC.

## Method

- Ran `npm run web` (Expo Metro on `:8081`) with `EXPO_PUBLIC_SUPABASE_*` pointed at a live Supabase project whose schema includes the `care_action` RPC.
- Drove the app via Chrome DevTools MCP (real browser: signup → hatch → care actions → rename → reload).
- Instrumented `window.fetch` to deterministically capture each `care_action` call's action + result and any `pets` write (the periodic `tick` RPC fires every 10s, so passive log-scraping alone was unreliable).
- Confirmed server state by reading `profiles` / `pets` rows directly via the authenticated session.

## Results

### 1. Care actions — all via `care_action`, correct stats, no console errors ✅

| Action | RPC | Result observed |
|---|---|---|
| FEED | `care_action(feed)` 200 | hunger 99.3 → **100**; happiness +3; cleanliness dipped (eating mess) |
| PLAY | `care_action(play)` 200 | happiness 77 → **99**; energy 78 → **66**; **reward 3** |
| CLEAN | `care_action(clean)` 200 | cleanliness → **100**; poops → **0** |
| SLEEP | `care_action(sleep)` 200 | `asleep: true` |
| WAKE | `care_action(wake)` 200 | `asleep: false` |
| MEDICINE | `care_action(medicine)` 200 | `sick: false`, health capped 100 |

- The decay-tick interval fires `care_action('tick')` automatically (~every 10s), returning the full server-owned pet row with decayed stats — the PR's new behavior.
- No app console errors throughout — only React-Native-Web framework deprecation warnings (`textShadow`, `shadow`, `pointerEvents`, `useNativeDriver`), present before any interaction.
- **MEDS** is correctly disabled in the UI for a healthy pet; the action path was exercised directly through the same authenticated Supabase session to confirm it returns 200.

### 2. Play credits tokens and respects the daily cap ✅

- Tokens credit **+3 per play**, server-side; the wallet header reflected each credit exactly.
- Both layers gate play at low energy: the client disables the PLAY button ("too tired") and the server requires `energy >= 10`.
- **Daily cap driven to the ceiling:** auto-played (sleep→regen→burst loop, since energy regen is real-time-bound) until `earned_today` reached **60**. The next eligible play returned:

  ```
  play → tokens 78, reward 3, energy 36   ← earned_today crosses to 60
  play → tokens 78, reward 0, energy 24   ← CAP HIT (wallet frozen)
  ```

  This is the daily-earn clamp, **not** the energy guard: the reward-0 play was awake with energy ≥10 and happiness still rose to 100, so the `play` branch executed but awarded 0. Server profile after: `earned_today: 60`, `tokens: 78` (frozen). Clamp: `reward := greatest(0, least(3, 60 - earned_today))`.
- **Daily reset also observed (incidental):** the regen waits crossed 00:00 UTC; `earned_today` reset to 0 and `earn_date` flipped while the cumulative wallet kept its balance — confirming the per-UTC-day reset logic.

### 3. Rename persists across reload ✅

- Renaming captured a single `PATCH /rest/v1/pets` with body **`{"name":"PixelReborn"}`** (204) — the name column only, no care columns.
- After a full page reload, the name came back from the server (fresh `GET /pets`), and the play-earned wallet + sleep state persisted too — confirming care is server-owned.
- Probe: renaming to whitespace fired **no** `PATCH /pets` and left the name unchanged (`if (!clean) return` guard holds).

### 4. Network audit — no direct `pets` care-column UPDATEs ✅

Across the entire session:
- Loads are `GET /pets` / `GET /profiles` (SELECTs).
- Pets are created/changed only via RPCs: `hatch_pet`, `care_action` (all 200s).
- Every sync `PATCH` targets `/profiles` (`active_pet_id`) — **zero `PATCH /pets` for care columns**.
- The only direct `pets` write is the intentional name-only rename PATCH.

## Notes for the author

- **Write amplification on `profiles`:** every `care_action` (including each automatic `tick`) is followed by a `PATCH /profiles` re-writing `active_pet_id`, even when it hasn't changed. Functionally correct, but consider skipping the sync when `active_pet_id` is unchanged.
- **Local repeatability:** there's no `.env.example` or local-stack recipe, and `supabase/` has no `config.toml`, so this PR can only be verified against a hosted project (Docker/WSL weren't available locally). A small verifier recipe capturing the `EXPO_PUBLIC_*` handle would make future Track B verifications one-step.

---

*Verification performed by driving the running app end-to-end through its real browser interface; verdicts reflect observed runtime behavior, not test/typecheck runs.*

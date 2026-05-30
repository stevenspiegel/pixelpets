# Pixel Pets

A Tamagotchi-style virtual pet game with battles, collecting, and a player
economy. Hatch a pixel egg, raise your creature through five life stages, train
it for combat, trade on the marketplace, and climb the leaderboard.

Built with [Expo](https://expo.dev), so the same code runs on **iOS, Android,
and the web** from a single codebase.

## Gameplay

### Raise a pet
- **Sign up** or **log in** — each account owns a collection of up to **8 pets**
- **Hatch** an egg (costs 150 tokens; you start with 150) and name your pet
- Watch it grow in real time through life stages: **egg → baby → child → teen →
  adult**. Stages are derived from the pet's immutable birth time
  (baby at 30s, child at ~1 day, teen at 2 days, adult at 3 days).
- Keep five care stats up: **hunger, happiness, cleanliness, energy, health**
- Stats **decay in real time** — even while the app is closed
- **Feed, play, clean, sleep/wake**, and give **medicine** when your pet gets sick
- Let poop pile up and your pet can get **sick**; ignore it too long and it can
  **pass away**. Start over with a new egg.

### Collect
- Every hatch rolls a **species** and a **rarity**: common → uncommon → rare →
  epic → legendary → **mythical**. Rarer rolls are far less likely (weighted
  60 / 25 / 10 / 4 / 1) and innately stronger in battle.
- ~30 hatchable species rendered as custom pixel sprites across all four stages
- **Dragons and unicorns can ascend** once adult — a one-way upgrade to mythical
- A couple of named-egg easter eggs guarantee a special species

### Battle
- **PvE** and **PvP** turn-based combat using each pet's base stats
  (**attack, defense, speed, max HP**)
- Three moves — **Attack, Power, Guard** — with crits, variance, and speed-based
  turn order
- **Level up by training** (spending tokens), not by aging; each life stage
  raises the training cap, so you grow your pet up to train it further
- Battles cost battle energy and award tokens

### Economy & social
- **Token wallet** earned through play, daily rewards, and battles
- **Store** — buy token packs via Stripe checkout
- **Daily quests / rewards**
- **Marketplace** — list and buy pets from other players
- **Friends** and a **Leaderboard**

## Architecture

Pixel Pets runs in two modes depending on whether a backend is configured:

- **Cloud mode** (Supabase env vars present): Supabase Auth + a
  **server-authoritative** Postgres backend. Game-critical logic (pet care,
  rewards, training, PvP results) runs server-side via RPCs so it can't be
  tampered with from the client. Token purchases go through Stripe via Supabase
  Edge Functions.
- **Local-only fallback** (no env vars): the app degrades gracefully to
  device-local accounts and AsyncStorage. Online-only features (PvP,
  marketplace, friends, leaderboard, daily, store) are hidden.

Accounts in local mode are stored on-device — multiple people on the same
phone/tablet can each have their own pets. Passwords are salted and SHA-256
hashed via `expo-crypto` before being written to AsyncStorage. Players who
started locally can **import** their pets into the cloud on first cloud login.

## Configuration

Cloud features are enabled by exposing Supabase credentials to the client.
Expo passes any `EXPO_PUBLIC_*` variable through to the app at build time:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Notes:
- Auth maps usernames to a synthetic email (`<user>@pixelpetsworld.com`), so
  **email confirmation must be turned OFF** in the Supabase dashboard.
- The database schema lives in [`supabase/schema.sql`](supabase/schema.sql).
- Stripe is wired through the Edge Functions in
  [`supabase/functions/`](supabase/functions) (`create-checkout`,
  `stripe-webhook`).

Without these vars set, the app still runs in local-only mode.

## Running locally

```bash
npm install

# Web (opens in your browser)
npm run web

# iOS simulator (macOS only)
npm run ios

# Android emulator
npm run android
```

If you hit network issues during `expo start`, prefix with `EXPO_OFFLINE=1`.

## Project layout

```
App.tsx                          entry; auth + view router across all screens
src/types.ts                     PetState, LifeStage, Rarity, BattleStats, ActionKind

src/state/
  useAuth.ts                     accounts: signup, login, logout, session (local + cloud)
  usePet.ts                      pet collection, decay tick, actions, training,
                                 rarity/species rolls, AsyncStorage + cloud sync
  daily.ts                       daily quest / reward logic
  purchases.ts                   token-pack purchase availability
  push.ts                        push notifications

src/battle/
  engine.ts                      turn resolution, moves, damage, AI
  opponent.ts                    PvE opponent generation
  pvp.ts                         PvP matchmaking + result recording
  tactics.ts                     battle helpers

src/social/
  friends.ts                     friend list
  marketplace.ts                 list / buy pets

src/lib/supabase.ts              Supabase client + isSupabaseConfigured gate
src/sprites/                     pixel-sprite registry, palette, image map

src/components/                  LoginScreen, HatchScreen, ImportScreen, GameScreen,
                                 Pet, BattleScreen, BattleStats, MarketplaceScreen,
                                 StoreScreen, DailyScreen, FriendsScreen,
                                 LeaderboardScreen, PetSwitcher, StatBar, etc.

supabase/
  schema.sql                     tables, RLS, and server-authoritative RPCs
  functions/                     Stripe Edge Functions (checkout + webhook)

scripts/                         sprite generation pipeline (ComfyUI + SDXL LoRA)
assets/                          app icon, splash, pixel art
```

## Sprites

The creature sprites are generated with a custom **ComfyUI + SDXL LoRA**
pipeline (see [`scripts/`](scripts) and `scripts/SPRITES.md`), producing a
baby/child/teen/adult set per species that is then wired into the sprite
registry. The original Pixel Pets pixel art (egg, header, backgrounds) is
preserved in `assets/`.

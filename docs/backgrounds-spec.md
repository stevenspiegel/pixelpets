# Pet Backgrounds — cosmetic feature spec

A token sink + personalization: players spend **earned** Pixel Tokens to unlock
background scenes that appear behind their pet on the home screen. No real-money
purchase (keeps it clear of the Apple-IAP question), and it gives tokens a
purpose beyond eggs.

## What the player sees

On the home screen the pet sits in the lit "screen" panel inside the
Tamagotchi-style frame (`GameScreen.tsx` → `styles.screen`, currently a flat
`#cfe9c8`). With this feature, that panel shows the equipped background image,
with the pet sprite composited on top. A new **🖼️ Backgrounds** menu tile opens
a picker: owned backgrounds are selectable; locked ones show a price and an
**Unlock (✦ N)** button.

## Art spec (what to draw)

- **Size: 512 × 512 px, square, PNG.**
- **Why square + that size:** the panel's width flexes by device (up to ~352px
  of inner content) but is roughly square; a 512² image scaled with
  `resizeMode: 'cover'` fills it crisply on high-DPI screens at any panel size.
- **Safe zone:** keep key art toward the **center**; the pet sprite (~180px)
  sits centered, and `cover` may crop a little off the edges on tall/wide panels.
  Treat the outer ~10% as bleed.
- **Style:** match the existing pixel art — limited palette, hard edges, no
  gradients/anti-aliasing. (Run through the repo's palette tooling in
  `scripts/` if you want exact palette consistency, but it's not required.)
- **No transparency needed** (it's a full background), though it's fine.
- **Readability:** the pet + its status text render on top, so avoid busy
  high-contrast detail dead-center — a calmer middle keeps the pet legible.
- **Filenames:** `assets/backgrounds/<id>.png`, e.g. `meadow.png`, `night.png`,
  `beach.png`, `space.png`, `lava.png`.

A good starter set: a free **default/plain** + ~4–6 themed scenes across price
points (cheap commons → pricey "premium" scenes).

## Data model (server)

Reuse the existing wallet/RPC anti-cheat pattern — the client never edits its own
inventory or wallet directly.

- `profiles.backgrounds text[] not null default '{default}'` — owned background
  ids (everyone starts owning `default`).
- `profiles.active_background text not null default 'default'` — the equipped one.
- **`unlock_background(p_id text, p_price int) → jsonb`** (SECURITY DEFINER):
  validates the id + price against a server-side catalog, checks/deducts tokens
  atomically, appends to `backgrounds`. Returns the new balance + owned list.
  (Price/catalog must live server-side so it can't be forged — mirror the
  `BACKGROUNDS` list from the client, like other constants are mirrored.)
- **`set_active_background(p_id text)`**: verifies the id is owned, sets
  `active_background`. (Or fold equip into a column the client may write to —
  but an RPC keeps it tamper-proof and consistent with care/wallet.)

A `BACKGROUNDS` catalog (id, name, price, asset) lives in the client
(`src/state/backgrounds.ts`) as the display source of truth, mirrored in the
unlock RPC for price validation.

## Client

- `src/state/backgrounds.ts` — the catalog (`{ id, name, price }[]`), the
  `id → require()` asset map, and `unlockBackground` / `setActiveBackground`
  wrappers (with `Result` error surfacing, like marketplace/friends).
- The pet collection load (`loadCloudCollection`) also reads `backgrounds` +
  `active_background` into state.
- `GameScreen` `styles.screen`: wrap the pet in an `ImageBackground` (or layered
  `Image` + absolute fill) using the active background's asset; default = the
  current flat color so nothing changes for players who haven't picked one.
- `BackgroundsScreen.tsx` — the picker/store, modeled on `StoreScreen` /
  `PixedexScreen` (grid of thumbnails, owned vs locked, equip vs unlock).
- `App.tsx`: add a `'backgrounds'` view + wire `onBackgrounds` into `GameScreen`.

## Rollout (phased, like the care work)

1. **Phase 1 (additive, safe):** schema columns + RPCs + catalog + the
   `ImageBackground` render defaulting to the current color. No art required yet
   — ships invisibly.
2. **Phase 2:** drop in the background PNGs + the `BackgroundsScreen` store and
   the menu tile. This is the player-facing turn-on.

## Open decisions (for you)

- **Scope:** per-pet background (each pet remembers its own) or per-account (one
  equipped scene)? **Per-account is simpler** and matches "active_background on
  the profile"; per-pet means moving the columns to `pets` and an equip per pet.
  Recommend **per-account** for v1.
- **Pricing:** rough token costs per tier (e.g. 50 / 150 / 400). Tune to your
  economy (egg = 150, play = 3/^60-day-cap).
- **How many** in the launch set, and the themes.

## What I need from you to build it

1. Confirm **per-account** (or per-pet).
2. A **price list** (even rough) for the launch backgrounds.
3. The **PNGs** (512×512) dropped into `assets/backgrounds/` — or I can stub
   Phase 1 with just the `default` (current color) and you add art for Phase 2.

# Pixel Pets

A React Native Tamagotchi-style virtual pet game. Hatch a pixel egg, then keep your
creature fed, clean, and happy as it grows from baby → child → teen → adult.

Built with [Expo](https://expo.dev), so the same code runs on iOS, Android, and the web.

## Gameplay

- **Sign up** or **log in** — each account has its own pet
- **Hatch** an egg and name your pet
- Watch it grow through life stages (egg → baby → child → teen → adult)
- Keep five stats happy: **hunger, happiness, cleanliness, energy, health**
- Stats decay in real time — even while the app is closed (state is persisted)
- **Feed, play, clean, sleep**, and **give medicine** when your pet gets sick
- Ignore your pet too long and it can pass away. Start over with a new egg.

## Accounts

Accounts are stored **locally on the device** — multiple people on the same
phone/tablet can each have their own pet. Passwords are salted and SHA-256
hashed via `expo-crypto` before being written to AsyncStorage. There is no
backend and no cross-device sync (yet).

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
App.tsx                          entry; routes between Login / Hatch / Game
src/types.ts                     PetState + ActionKind types
src/state/useAuth.ts             local accounts: signup, login, logout, session
src/state/usePet.ts              decay tick, actions, per-user AsyncStorage save
src/components/LoginScreen.tsx   login / signup tabs
src/components/HatchScreen.tsx   name-your-pet + hatch CTA
src/components/GameScreen.tsx    Tamagotchi shell: pet display, stats, action buttons
src/components/Pet.tsx           animated sprite (egg → emoji creature) + mood/poop overlays
src/components/StatBar.tsx       individual stat bar
src/components/ActionButton.tsx  pressable action button
assets/                          pixel art (egg, header, background, favicon)
```

The pixel art for the egg, header, and backgrounds is preserved from the original
Pixel Pets static site.

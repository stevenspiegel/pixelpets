// Dev harness: preview the Base / Habitat screen with a sample of every
// decoration placed, without needing Supabase auth or a real account.
//
// How to open it (dev builds only — see the __DEV__ gate in App.tsx):
//   • Web:    npm run web        then visit http://localhost:8081/?preview=base
//             (or just `npm run preview:base`, which sets the env for you)
//   • Native: EXPO_PUBLIC_PREVIEW=base in .env, then npm start
//
// It mounts the real BaseScreen with a seeded layout, so what you see is exactly
// how the game renders the art (including full-bleed fence tiling). Editing
// works in-memory; Save won't persist (no server).
import React from 'react';
import { BaseScreen } from '../components/BaseScreen';
import { BASE_DECOR, BaseState } from '../state/base';

// A tidy showcase layout on the 6x6 grid: a full top row of horizontal fences
// (they touch), the left column of vertical fences, and the rest scattered.
const SAMPLE_BASE: BaseState = {
  owned: BASE_DECOR.map((d) => d.id),
  layout: [
    // Closed wall loop: corners at (0,0)/(5,0)/(0,5)/(5,5), straights between.
    { id: 'fence', x: 0, y: 0 }, { id: 'fence', x: 1, y: 0 }, { id: 'fence', x: 2, y: 0 },
    { id: 'fence', x: 3, y: 0 }, { id: 'fence', x: 4, y: 0 }, { id: 'fence', x: 5, y: 0 },
    { id: 'fence', x: 0, y: 5 }, { id: 'fence', x: 1, y: 5 }, { id: 'fence', x: 2, y: 5 },
    { id: 'fence', x: 3, y: 5 }, { id: 'fence', x: 4, y: 5 }, { id: 'fence', x: 5, y: 5 },
    { id: 'fence', x: 0, y: 1 }, { id: 'fence', x: 0, y: 2 }, { id: 'fence', x: 0, y: 3 }, { id: 'fence', x: 0, y: 4 },
    { id: 'fence', x: 5, y: 1 }, { id: 'fence', x: 5, y: 2 }, { id: 'fence', x: 5, y: 3 }, { id: 'fence', x: 5, y: 4 },
    { id: 'tree', x: 2, y: 2 }, { id: 'bush', x: 3, y: 2 }, { id: 'rock', x: 1, y: 2 },
    { id: 'ball', x: 4, y: 2 }, { id: 'lamp', x: 5, y: 2 },
    { id: 'flowers', x: 2, y: 4 }, { id: 'bowl', x: 3, y: 4 }, { id: 'pond', x: 4, y: 4 },
    { id: 'bed', x: 5, y: 4 },
  ],
  pets: [],
  floor: 'grass',
  fuel: {},
  // One building ready to collect (mine, backdated 6h) and one still on cooldown
  // (vault, just collected) so the harness exercises both badge states.
  buildings: {
    mine: { level: 2, x: 2, y: 1, collectedAt: Date.now() - 6 * 3600 * 1000 },
    vault: { level: 1, x: 3, y: 1, collectedAt: Date.now() },
  },
  eggShards: 45,
};

export const BasePreview: React.FC = () => (
  <BaseScreen
    preview={SAMPLE_BASE}
    pets={[]}
    tokens={999}
    onWalletChange={() => {}}
    onExit={() => {}}
  />
);

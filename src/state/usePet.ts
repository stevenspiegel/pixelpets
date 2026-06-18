import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  PetState,
  ActionKind,
  LifeStage,
  Rarity,
  BattleStats,
  StatKey,
  DRAGON_SPECIES,
  UNICORN_SPECIES,
} from '../types';

const STORAGE_PREFIX_V1 = '@pixelpets/pet/v1/';   // legacy single-pet save
const STORAGE_PREFIX_V2 = '@pixelpets/pets/v2/';  // collection of pets
const v1Key = (userId: string) => `${STORAGE_PREFIX_V1}${userId}`;
const v2Key = (userId: string) => `${STORAGE_PREFIX_V2}${userId}`;
// Marks that a user has already imported (or declined) their local pets into
// the cloud, so we don't keep prompting.
const importedKey = (userId: string) => `@pixelpets/imported/v1/${userId}`;

export const MAX_PETS = 10;

// Only full-body emoji — face-only emoji (🐶 🐱 🦁 etc.) are intentionally
// excluded so every newly hatched pet shows as a recognizable creature
// rather than a floating head.
const SPECIES_BY_RARITY: Record<Rarity, readonly string[]> = {
  common:    ['🐕', '🐈', '🐇', '🐢'],
  uncommon:  ['🦊', '🐍', '🦎', '🦇', '🦔', '🐧'],
  rare:      ['🦥', '🦉', '🦅', '🦘', '🦫', '🦒'],
  epic:      ['🐅', '🐘', '🐊', '🦈', '🐙', '🦖'],
  legendary: ['🐉', '🦄', '🧜'],
  // Not hatchable — reached only by ascending a dragon or unicorn.
  mythical: [],
};

// Species no longer in the hatch pool, kept so existing pets still classify
// and render. Includes both very-old face emoji and species retired later.
const LEGACY_RARITY: Record<string, Rarity> = {
  '🐦': 'common',  '🐠': 'common',
  '🐶': 'common',  '🐱': 'common',  '🐰': 'common',
  '🐭': 'common',  '🐹': 'common',  '🐁': 'common',  '🐀': 'common',
  '🐸': 'uncommon', '🦨': 'uncommon',
  '🐺': 'rare',    '🐼': 'rare',    '🐨': 'rare',  '🦡': 'rare',  '🦦': 'rare',
  '🦁': 'epic',    '🐯': 'epic',    '🦛': 'epic',  '🦚': 'epic',  '🦬': 'epic',
  '🐲': 'legendary', '🦕': 'legendary', // 🦕 sauropod retired from the pool
  // 🦌 deer retired from the pool; 🦖 T-Rex moved to epic (still hatchable).
  // 🦏 rhino + 🦝 raccoon removed entirely.
  '🦌': 'rare',
};

// Human-readable name for each species emoji, used in the UI.
const SPECIES_NAMES: Record<string, string> = {
  '🐕': 'Dog',     '🐈': 'Cat',      '🐇': 'Rabbit',  '🐁': 'Mouse',
  '🐀': 'Rat',     '🐦': 'Bird',     '🐢': 'Turtle',  '🐠': 'Fish',
  '🦊': 'Fox',     '🦨': 'Skunk',    '🐍': 'Snake',
  '🦎': 'Lizard',  '🦇': 'Bat',      '🦔': 'Hedgehog','🐧': 'Penguin',
  '🦡': 'Badger',  '🦌': 'Deer',     '🦥': 'Sloth',   '🦉': 'Owl',
  '🦅': 'Eagle',   '🦘': 'Kangaroo', '🦦': 'Otter',   '🦫': 'Beaver',
  '🐅': 'Tiger',   '🐘': 'Elephant', '🐊': 'Crocodile',
  '🦈': 'Shark',   '🦒': 'Giraffe',  '🦚': 'Peacock', '🦬': 'Bison',
  '🐉': 'Dragon',  '🦄': 'Unicorn',  '🧜': 'Mermaid', '🦖': 'T-Rex',
  '🦕': 'Sauropod','🐙': 'Octopus',
  // legacy species from earlier hatches
  '🐶': 'Dog',     '🐱': 'Cat',      '🐰': 'Rabbit',  '🐭': 'Mouse',
  '🐹': 'Hamster', '🐸': 'Frog',     '🐺': 'Wolf',    '🐼': 'Panda',
  '🐨': 'Koala',   '🦁': 'Lion',     '🐯': 'Tiger',   '🦛': 'Hippo',
  '🐲': 'Dragon',
};

export const speciesName = (species: string): string =>
  SPECIES_NAMES[species] ?? 'Critter';

// Pixedex catalog: the hatchable species grouped by rarity tier, for the
// collection screen. Mirrors SPECIES_BY_RARITY (mythical excluded — it's an
// ascension form, not a discoverable species).
export const PIXEDEX_TIERS: { rarity: Rarity; species: readonly string[] }[] = (
  ['common', 'uncommon', 'rare', 'epic', 'legendary'] as Rarity[]
).map((rarity) => ({ rarity, species: SPECIES_BY_RARITY[rarity] }));

// Total discoverable species across all tiers.
export const PIXEDEX_TOTAL = PIXEDEX_TIERS.reduce((n, t) => n + t.species.length, 0);

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
  mythical: 0, // never rolled; only reached via ascension
};

// Drives the hatch roll; mythical is intentionally excluded (ascension only).
const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Naming an egg one of these (case-insensitive) guarantees that species
// at hatch instead of a random roll. Easter eggs.
const SPECIAL_NAMES: Record<string, { species: string; rarity: Rarity }> = {
  spyro: { species: DRAGON_SPECIES, rarity: 'legendary' },
  moonbeam: { species: UNICORN_SPECIES, rarity: 'legendary' },
};

const rollSpecies = (name?: string): { species: string; rarity: Rarity } => {
  const special = name && SPECIAL_NAMES[name.trim().toLowerCase()];
  if (special) return special;
  const totalWeight = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of RARITY_ORDER) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll <= 0) {
      const pool = SPECIES_BY_RARITY[rarity];
      return { species: pool[Math.floor(Math.random() * pool.length)], rarity };
    }
  }
  const pool = SPECIES_BY_RARITY.common;
  return { species: pool[0], rarity: 'common' };
};

const rarityForSpecies = (species: string): Rarity => {
  for (const rarity of RARITY_ORDER) {
    if (SPECIES_BY_RARITY[rarity].includes(species)) return rarity;
  }
  return LEGACY_RARITY[species] ?? 'common';
};

// === Battle stats ===================================================
// Rarer pets are innately stronger.
const RARITY_POWER: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.2,
  rare: 1.45,
  epic: 1.75,
  legendary: 2.2,
  mythical: 2.6,
};

const MAX_LEVEL = 50;
const SECONDS_PER_LEVEL = 900; // +1 level every ~15 min of age
const ASCENDED_STAT_MULT = 1.5;

// Deterministic 0..1 generator seeded by a string, so a pet's rolled base
// stats are stable for its id regardless of when they're computed.
const seededRandom = (seed: string): (() => number) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const rollStats = (id: string, rarity: Rarity): BattleStats => {
  const rnd = seededRandom(id);
  const mult = RARITY_POWER[rarity];
  const stat = (base: number, spread: number) =>
    Math.round((base + rnd() * spread) * mult);
  return {
    attack: stat(10, 8),
    defense: stat(10, 8),
    speed: stat(10, 8),
    maxHp: stat(40, 30),
  };
};

// Used only to grandfather existing pets: the old age-derived level, kept so
// migrated pets don't lose power when level became training-driven.
const ageLevel = (age: number): number =>
  Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, age) / SECONDS_PER_LEVEL));

// Level now comes from training (see trainStat), not age. Stored on the pet.
export const petLevel = (pet: PetState): number =>
  Math.min(MAX_LEVEL, Math.max(1, pet.level ?? 1));

// Max level a pet can train to at each life stage — grow up to train further.
const STAGE_LEVEL_CAP: Record<LifeStage, number> = {
  egg: 0,
  baby: 10,
  child: 20,
  teen: 35,
  adult: MAX_LEVEL,
  dead: 0,
};

export const stageLevelCap = (stage: LifeStage): number => STAGE_LEVEL_CAP[stage];

export const canTrain = (pet: PetState): boolean =>
  pet.stage !== 'egg' &&
  pet.stage !== 'dead' &&
  (pet.level ?? 1) < STAGE_LEVEL_CAP[pet.stage];

// Effective combat stats: base × level growth × ascension bonus, plus level.
export const battleStats = (
  pet: PetState
): BattleStats & { level: number } => {
  const level = petLevel(pet);
  const growth = 1 + (level - 1) * 0.05; // +5% per level
  const asc = pet.ascended ? ASCENDED_STAT_MULT : 1;
  const scale = (n: number) => Math.round(n * growth * asc);
  return {
    level,
    attack: scale(pet.stats.attack),
    defense: scale(pet.stats.defense),
    speed: scale(pet.stats.speed),
    maxHp: scale(pet.stats.maxHp),
  };
};

const makeId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const migratePet = (pet: PetState): PetState => {
  let next = pet;
  if (!next.id) next = { ...next, id: makeId() };
  if (!next.rarity) next = { ...next, rarity: rarityForSpecies(next.species) };
  if (!next.stats) next = { ...next, stats: rollStats(next.id, next.rarity) };
  // Pets from before training-driven levels keep their old age-based level as
  // a starting point; it only changes via training from here on.
  if (next.level == null) next = { ...next, level: ageLevel(next.age) };
  return next;
};

const TICK_MS = 10000;

// Life-stage thresholds (seconds since birth).
export const STAGE_BABY_AT = 30;        // 30s — egg hatches
const STAGE_CHILD_AT = 86400;    // baby: ~1 day
const STAGE_TEEN_AT = 172800;    // child: 1 more day (2 days total)
const STAGE_ADULT_AT = 259200;   // teen: 1 more day (adult at 3 days)

const HUNGER_DRAIN = 0.01;
const HAPPINESS_DRAIN = 0.008;
const CLEAN_DRAIN = 0.005;
const ENERGY_DRAIN = 0.007;
const ENERGY_GAIN_SLEEPING = 0.2;
const POOP_INTERVAL_SEC = 3600;

const HEALTH_DRAIN_HUNGRY = 0.012;
const HEALTH_DRAIN_SAD = 0.006;
const HEALTH_DRAIN_DIRTY = 0.005;
const HEALTH_DRAIN_SICK = 0.008;
const HEALTH_RECOVER_HAPPY = 0.003;

const SICK_RATE = 0.0002;

const OFFLINE_THRESHOLD_SEC = 30;
const OFFLINE_MULTIPLIER = 0.1;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const scaleElapsed = (rawElapsed: number): number => {
  if (rawElapsed <= OFFLINE_THRESHOLD_SEC) return rawElapsed;
  return (
    OFFLINE_THRESHOLD_SEC +
    (rawElapsed - OFFLINE_THRESHOLD_SEC) * OFFLINE_MULTIPLIER
  );
};

const createPet = (name: string): PetState => {
  const { species, rarity } = rollSpecies(name);
  const id = makeId();
  return {
    id,
    name: name || 'Pixel',
    species,
    rarity,
    stats: rollStats(id, rarity),
    level: 1,
    stage: 'egg',
    hunger: 70,
    happiness: 70,
    cleanliness: 90,
    energy: 80,
    health: 100,
    age: 0,
    bornAt: Date.now(),
    lastTick: Date.now(),
    asleep: false,
    poops: 0,
    sick: false,
    ascended: false,
  };
};

const stageFromAge = (ageSeconds: number): LifeStage => {
  if (ageSeconds < STAGE_BABY_AT) return 'egg';
  if (ageSeconds < STAGE_CHILD_AT) return 'baby';
  if (ageSeconds < STAGE_TEEN_AT) return 'child';
  if (ageSeconds < STAGE_ADULT_AT) return 'teen';
  return 'adult';
};

const applyDecay = (pet: PetState, now: number): PetState => {
  if (pet.stage === 'dead') return pet;
  const rawElapsed = Math.max(0, (now - pet.lastTick) / 1000);
  if (rawElapsed < 0.5) return pet;

  const scaledElapsed = scaleElapsed(rawElapsed);
  const sleepMultiplier = pet.asleep ? 0.25 : 1;
  const next: PetState = { ...pet };

  next.age = pet.age + rawElapsed;
  next.stage = stageFromAge(next.age);

  if (next.stage === 'egg') {
    next.lastTick = now;
    return next;
  }

  next.hunger = clamp(pet.hunger - scaledElapsed * HUNGER_DRAIN * sleepMultiplier);
  next.happiness = clamp(
    pet.happiness - scaledElapsed * HAPPINESS_DRAIN * sleepMultiplier
  );
  next.cleanliness = clamp(pet.cleanliness - scaledElapsed * CLEAN_DRAIN);
  next.energy = pet.asleep
    ? clamp(pet.energy + scaledElapsed * ENERGY_GAIN_SLEEPING)
    : clamp(pet.energy - scaledElapsed * ENERGY_DRAIN);

  if (!pet.asleep) {
    next.poops = Math.min(pet.poops + scaledElapsed / POOP_INTERVAL_SEC, 8);
  }

  if (Math.floor(next.poops) >= 2 && !pet.sick) {
    const sickProb = 1 - Math.exp(-scaledElapsed * SICK_RATE);
    if (Math.random() < sickProb) next.sick = true;
  }

  let healthDelta = 0;
  if (next.hunger <= 0) healthDelta -= scaledElapsed * HEALTH_DRAIN_HUNGRY;
  if (next.happiness <= 0) healthDelta -= scaledElapsed * HEALTH_DRAIN_SAD;
  if (next.cleanliness <= 0) healthDelta -= scaledElapsed * HEALTH_DRAIN_DIRTY;
  if (next.sick) healthDelta -= scaledElapsed * HEALTH_DRAIN_SICK;
  if (
    next.hunger > 60 &&
    next.happiness > 60 &&
    next.cleanliness > 60 &&
    !next.sick
  ) {
    healthDelta += scaledElapsed * HEALTH_RECOVER_HAPPY;
  }
  next.health = clamp(pet.health + healthDelta);
  if (next.health <= 0) {
    next.stage = 'dead';
    next.asleep = false;
  }

  next.lastTick = now;
  return next;
};

// Dragons and unicorns may ascend once adult. One-way, terminal upgrade.
export const canAscend = (pet: PetState): boolean =>
  (pet.species === DRAGON_SPECIES || pet.species === UNICORN_SPECIES) &&
  pet.stage === 'adult' &&
  !pet.ascended;

// An ascended pet is shown as mythical (one tier above legendary). Derived so
// existing ascended pets reclassify without a migration.
export const effectiveRarity = (pet: {
  rarity: Rarity;
  ascended?: boolean;
}): Rarity => (pet.ascended ? 'mythical' : pet.rarity);

const applyAction = (pet: PetState, kind: ActionKind, now: number): PetState => {
  if (pet.stage === 'dead' || pet.stage === 'egg') return pet;
  const base = applyDecay(pet, now);
  switch (kind) {
    case 'ascend':
      if (!canAscend(base)) return base;
      return { ...base, ascended: true };
    case 'feed':
      if (base.asleep) return base;
      return {
        ...base,
        hunger: clamp(base.hunger + 28),
        cleanliness: clamp(base.cleanliness - 4),
        happiness: clamp(base.happiness + 3),
      };
    case 'play':
      if (base.asleep) return base;
      if (base.energy < 10) return base;
      return {
        ...base,
        happiness: clamp(base.happiness + 22),
        energy: clamp(base.energy - 12),
        hunger: clamp(base.hunger - 4),
      };
    case 'clean':
      return {
        ...base,
        cleanliness: clamp(base.cleanliness + 35),
        poops: 0,
      };
    case 'sleep':
      return { ...base, asleep: true };
    case 'wake':
      return { ...base, asleep: false };
    case 'medicine':
      return {
        ...base,
        sick: false,
        health: clamp(base.health + 15),
      };
    default:
      return base;
  }
};

// === Pixel tokens (account-level currency) ==========================
export type Wallet = {
  tokens: number;
  earnDate: string; // YYYY-MM-DD of the current earning day
  earnedToday: number;
};

// Tokens earned per successful PLAY, and the daily earning cap.
export const PLAY_REWARD = 3;
export const DAILY_EARN_CAP = 60;
// Hatching an egg costs tokens. Eggs are meant to be a real investment you
// save up for; new accounts start with exactly one egg's worth.
export const EGG_COST = 150;
const STARTING_TOKENS = EGG_COST;

// Energy a single battle costs the active pet. Paces repeat battling: a pet at
// full energy gets ~5 fights before it must rest, so it can't grind forever.
export const BATTLE_ENERGY_COST = 20;

// How much one training step raises each base stat.
export const STAT_INCREMENT: Record<StatKey, number> = {
  attack: 1,
  defense: 1,
  speed: 1,
  maxHp: 4,
};

// Token cost to train a stat once, rising with the current base value.
export const trainCost = (stat: StatKey, baseValue: number): number =>
  stat === 'maxHp'
    ? 5 + Math.floor(baseValue / 8)
    : 5 + Math.floor(baseValue / 2);

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const emptyWallet = (): Wallet => ({
  tokens: STARTING_TOKENS,
  earnDate: todayStr(),
  earnedToday: 0,
});

// Add tokens, honoring the daily cap (resets when the date rolls over).
const awardTokens = (w: Wallet, amount: number): Wallet => {
  const today = todayStr();
  const day = w.earnDate === today ? w : { ...w, earnDate: today, earnedToday: 0 };
  const room = Math.max(0, DAILY_EARN_CAP - day.earnedToday);
  const gain = Math.min(amount, room);
  if (gain <= 0) return day === w ? w : day;
  return { ...day, tokens: day.tokens + gain, earnedToday: day.earnedToday + gain };
};

type Collection = {
  pets: PetState[];
  activeId: string | null;
  wallet: Wallet;
};

const EMPTY: Collection = { pets: [], activeId: null, wallet: emptyWallet() };

// Result of a hatch attempt, so the UI can show why it failed (collection full,
// not enough tokens, …) instead of the button silently doing nothing.
export type HatchResult = { ok: true } | { ok: false; error: string };

const tickAll = (col: Collection, now: number): Collection => {
  if (col.pets.length === 0) return col;
  const next = col.pets.map((p) => applyDecay(p, now));
  // Reference equality check — if every pet was unchanged, return original
  let changed = false;
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== col.pets[i]) { changed = true; break; }
  }
  return changed ? { ...col, pets: next } : col;
};

const loadCollection = async (userId: string): Promise<Collection> => {
  try {
    const v2 = await AsyncStorage.getItem(v2Key(userId));
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<Collection>;
      const migrated = (parsed.pets ?? []).map(migratePet);
      const validActive = migrated.find((p) => p.id === parsed.activeId)?.id
        ?? migrated[0]?.id
        ?? null;
      return {
        pets: migrated,
        activeId: validActive,
        wallet: parsed.wallet ?? emptyWallet(),
      };
    }
    // Legacy migration: a single-pet v1 save becomes a one-element collection.
    const v1 = await AsyncStorage.getItem(v1Key(userId));
    if (v1) {
      const pet = migratePet(JSON.parse(v1) as PetState);
      return { pets: [pet], activeId: pet.id, wallet: emptyWallet() };
    }
  } catch {
    // fall through
  }
  return EMPTY;
};

// Scan ALL local saves on this device (any username key), so a manual restore
// works even if the local pets were saved under a different username than the
// current cloud account. Returns a de-duplicated, migrated pet list.
/* eslint-disable @typescript-eslint/no-explicit-any */
const findLocalPets = async (): Promise<PetState[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const relevant = keys.filter(
      (k) => k.startsWith(STORAGE_PREFIX_V2) || k.startsWith(STORAGE_PREFIX_V1)
    );
    const seen = new Set<string>();
    const found: PetState[] = [];
    for (const key of relevant) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const list: any[] = key.startsWith(STORAGE_PREFIX_V2)
          ? parsed?.pets ?? []
          : [parsed];
        for (const p of list) {
          if (!p || !p.species) continue;
          const mp = migratePet(p as PetState);
          if (!seen.has(mp.id)) {
            seen.add(mp.id);
            found.push(mp);
          }
        }
      } catch {
        // skip unparseable key
      }
    }
    return found;
  } catch {
    return [];
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Cloud (Supabase) storage ──────────────────────────────────────────────────
// DB rows are snake_case; PetState is camelCase. Numeric columns are coerced
// since PostgREST can return bigints as strings.
/* eslint-disable @typescript-eslint/no-explicit-any */
// Care state (hunger/energy/health/…) is server-owned: it changes only through
// the care_action RPC (called by the care buttons and the periodic tick), never
// via direct client column writes. The client persists only the active-pet
// selection (below) and pet names (renamePet).

const petFromRow = (r: any): PetState => ({
  id: r.id,
  name: r.name,
  species: r.species,
  rarity: r.rarity,
  stats: r.stats,
  level: Number(r.level),
  stage: r.stage,
  hunger: Number(r.hunger),
  happiness: Number(r.happiness),
  cleanliness: Number(r.cleanliness),
  energy: Number(r.energy),
  health: Number(r.health),
  age: Number(r.age),
  bornAt: Number(r.born_at),
  lastTick: Number(r.last_tick),
  asleep: !!r.asleep,
  poops: Number(r.poops),
  sick: !!r.sick,
  ascended: !!r.ascended,
});

const loadCloudCollection = async (): Promise<Collection> => {
  if (!supabase) return EMPTY;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return EMPTY;
  const [profileRes, petsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('pets').select('*').eq('owner', uid),
  ]);
  if (profileRes.error) console.warn('[pixelpets] load profile error:', profileRes.error.message);
  // A failed pets fetch must NOT be treated as "zero pets": returning an empty
  // collection here let the debounced sync wipe every cloud pet. Fail loudly so
  // callers keep the existing state instead of syncing emptiness.
  if (petsRes.error) throw new Error(`load pets failed: ${petsRes.error.message}`);
  const profile = profileRes.data;
  const pets = (petsRes.data ?? []).map(petFromRow).map(migratePet);
  const wallet: Wallet = profile
    ? {
        tokens: Number(profile.tokens ?? STARTING_TOKENS),
        earnDate: profile.earn_date ?? '',
        earnedToday: Number(profile.earned_today ?? 0),
      }
    : emptyWallet();
  const activeId =
    profile?.active_pet_id && pets.some((p) => p.id === profile.active_pet_id)
      ? profile.active_pet_id
      : pets[0]?.id ?? null;
  return { pets, activeId, wallet };
};

// Make the DB match the client collection: update each pet's care state,
// delete any rows that were removed, and update the profile (active pet).
let lastActiveSync: { uid: string; activeId: string | null } | null = null;
const syncCloudCollection = async (col: Collection): Promise<void> => {
  if (!supabase) return;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;

  // Care + wallet are server-owned now (care_action / wallet RPCs), so the
  // client never writes those columns. This sync persists only the active-pet
  // selection — and skips when it's unchanged, so the 10s decay tick doesn't
  // re-PATCH /profiles with the same value. (Pets are created/removed solely by
  // server RPCs.)
  if (lastActiveSync && lastActiveSync.uid === uid && lastActiveSync.activeId === col.activeId) {
    return;
  }
  const prof = await supabase
    .from('profiles')
    .update({ active_pet_id: col.activeId })
    .eq('id', uid);
  if (prof.error) console.warn('[pixelpets] update profile error:', prof.error.message);
  else lastActiveSync = { uid, activeId: col.activeId };
};
/* eslint-enable @typescript-eslint/no-explicit-any */



export const usePet = (userId: string | null) => {
  const [col, setCol] = useState<Collection>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // Local pets found on this device, offered for one-time import to the cloud.
  const [importable, setImportable] = useState<Collection | null>(null);
  const colRef = useRef<Collection>(col);
  const userRef = useRef<string | null>(userId);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    colRef.current = col;
  }, [col]);

  useEffect(() => {
    userRef.current = userId;
    setImportable(null);
    if (!userId) {
      setCol(EMPTY);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      let loadedCol: Collection;
      try {
        loadedCol = isSupabaseConfigured
          ? await loadCloudCollection()
          : await loadCollection(userId);
      } catch (e) {
        // Load failed: leave existing state untouched and stay "unloaded" so the
        // sync effect never runs against an empty collection. A remount/refresh
        // retries.
        console.warn('[pixelpets] collection load failed:', (e as Error).message);
        return;
      }
      if (cancelled) return;
      setCol({
        pets: loadedCol.pets.map((p) => applyDecay(p, Date.now())),
        activeId: loadedCol.activeId,
        wallet: loadedCol.wallet,
      });
      setLoaded(true);
      // First cloud login with no cloud pets: offer to import local pets
      // found anywhere on this device (any username key).
      if (isSupabaseConfigured && loadedCol.pets.length === 0) {
        const done = await AsyncStorage.getItem(importedKey(userId));
        if (cancelled || done) return;
        const localPets = await findLocalPets();
        if (!cancelled && localPets.length > 0) {
          setImportable({
            pets: localPets,
            activeId: localPets[0].id,
            wallet: loadedCol.wallet,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist on change. Cloud sync is debounced so the decay tick doesn't
  // hammer the database; local storage writes immediately.
  useEffect(() => {
    if (!userId || !loaded) return;
    if (isSupabaseConfigured) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        // Persist the LATEST committed collection (colRef), not the value
        // captured when this effect ran — which can be one render stale.
        syncCloudCollection(colRef.current).catch(() => {});
      }, 2000);
      // Cancel a pending write on unmount / account switch so it can't fire
      // with the previous user's collection.
      return () => {
        if (syncTimer.current) clearTimeout(syncTimer.current);
      };
    }
    AsyncStorage.setItem(v2Key(userId), JSON.stringify(col)).catch(() => {});
  }, [col, userId, loaded]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = colRef.current;
      if (current.pets.length === 0) return;
      setCol((c) => tickAll(c, Date.now()));
      // Persist the active pet's passive decay server-side (care is server-owned;
      // the client no longer writes care columns). Other pets decay lazily — the
      // server recomputes from last_tick whenever they're acted on or loaded.
      const activeId = current.activeId;
      if (isSupabaseConfigured && activeId) {
        (async () => {
          const { data, error } = await supabase!.rpc('care_action', {
            p_pet_id: activeId,
            p_action: 'tick',
          });
          if (error || data == null) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const serverPet = applyDecay(petFromRow((data as any).pet), Date.now());
          setCol((c) => ({
            ...c,
            pets: c.pets.map((p) => (p.id === serverPet.id ? serverPet : p)),
          }));
        })();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hatch = useCallback(async (name: string, useShards = false): Promise<HatchResult> => {
    if (!userRef.current) return { ok: false, error: 'Not signed in' };
    if (isSupabaseConfigured) {
      // Server rolls the species/rarity/stats, charges the egg cost, and inserts
      // the pet — nothing about it is client-supplied, so it can't be forged.
      // useShards funds the egg from accrued egg_shards (150 = 1 free egg)
      // instead of tokens; the server enforces the balance either way.
      const { data, error } = await supabase!.rpc('hatch_pet', { p_name: name, p_use_shards: useShards });
      if (error) {
        // Surface the reason (e.g. "Your collection is full", "Not enough
        // tokens") instead of failing silently.
        const msg = error.message.includes(':')
          ? error.message.slice(error.message.lastIndexOf(':') + 1).trim()
          : error.message;
        console.warn('[pixelpets] hatch error:', error.message);
        return { ok: false, error: msg };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      const pet = applyDecay(petFromRow(res.pet), Date.now());
      setCol((c) => ({
        ...c,
        pets: c.pets.length >= MAX_PETS ? c.pets : [...c.pets, pet],
        activeId: pet.id,
        wallet: { ...c.wallet, tokens: Number(res.tokens) },
      }));
      return { ok: true };
    }
    // Local-only mode.
    const c = colRef.current;
    if (c.pets.length >= MAX_PETS) return { ok: false, error: 'Your collection is full' };
    if (c.wallet.tokens < EGG_COST) return { ok: false, error: 'Not enough tokens' };
    const pet = createPet(name);
    setCol((cur) => ({
      ...cur,
      pets: [...cur.pets, pet],
      activeId: pet.id,
      wallet: { ...cur.wallet, tokens: cur.wallet.tokens - EGG_COST },
    }));
    return { ok: true };
  }, []);

  const switchPet = useCallback((id: string) => {
    setCol((c) => (c.pets.some((p) => p.id === id) ? { ...c, activeId: id } : c));
  }, []);

  // Re-read the collection from the cloud, replacing local state. Used after a
  // marketplace transfer (so an adopted pet appears and a sold one disappears)
  // and to revert a rejected optimistic change. No-op in local-only mode.
  // Declared before removePet, which depends on it.
  const reloadCollection = useCallback(async () => {
    if (!isSupabaseConfigured || !userRef.current) return;
    // Flush any pending care edits before replacing local state with the cloud
    // copy, so a reload (marketplace transfer / failed-op revert) doesn't drop
    // several seconds of un-synced changes across the whole collection.
    await syncCloudCollection(colRef.current).catch(() => {});
    let fresh: Collection;
    try {
      fresh = await loadCloudCollection();
    } catch (e) {
      // Don't overwrite local state with nothing if the reload fails.
      console.warn('[pixelpets] reload failed, keeping current state:', (e as Error).message);
      return;
    }
    setCol({
      pets: fresh.pets.map((p) => applyDecay(p, Date.now())),
      activeId: fresh.activeId,
      wallet: fresh.wallet,
    });
  }, []);

  const removePet = useCallback((id: string) => {
    // Optimistically drop it locally...
    setCol((c) => {
      const remaining = c.pets.filter((p) => p.id !== id);
      const activeId =
        c.activeId === id ? remaining[0]?.id ?? null : c.activeId;
      return { ...c, pets: remaining, activeId };
    });
    // ...then delete it server-side. Without this the row survives and a reload
    // brings the released pet back. release_pet also clears active_pet_id if it
    // pointed at this pet. Revert from the cloud if the delete fails.
    if (isSupabaseConfigured) {
      (async () => {
        const { error } = await supabase!.rpc('release_pet', { p_pet_id: id });
        if (error) {
          console.warn('[pixelpets] release error:', error.message);
          await reloadCollection();
        }
      })();
    }
  }, [reloadCollection]);

  // Can the active pet start a battle right now? Pure check (no side effects)
  // so it's safe to call before contacting the server / picking an opponent.
  const canBattleActive = useCallback((): boolean => {
    const c = colRef.current;
    const active = c.pets.find((p) => p.id === c.activeId);
    if (!active) return false;
    const d = applyDecay(active, Date.now());
    if (d.stage === 'egg' || d.stage === 'dead') return false;
    return d.energy >= BATTLE_ENERGY_COST;
  }, []);

  // Charge the active pet's energy for one battle. Called once a fight actually
  // begins; the debounced cloud sync then persists the lowered energy.
  const spendBattleEnergy = useCallback(() => {
    setCol((c) => {
      const now = Date.now();
      return {
        ...c,
        pets: c.pets.map((p) => {
          if (p.id !== c.activeId) return p;
          const d = applyDecay(p, now);
          return { ...d, energy: clamp(d.energy - BATTLE_ENERGY_COST) };
        }),
      };
    });
  }, []);

  const act = useCallback((kind: ActionKind) => {
    const cloud = isSupabaseConfigured;

    // Cloud: every care action except ascension goes through care_action, which
    // decays the pet, applies the action with server-enforced deltas, and (for
    // 'play') credits the capped reward. Apply optimistically for a snappy UI,
    // then reconcile to the authoritative pet the server returns.
    if (cloud && kind !== 'ascend') {
      const id = colRef.current.activeId;
      if (!id) return;
      setCol((c) => ({
        ...c,
        pets: c.pets.map((p) =>
          p.id === id ? applyAction(p, kind, Date.now()) : p
        ),
      }));
      (async () => {
        const { data, error } = await supabase!.rpc('care_action', {
          p_pet_id: id,
          p_action: kind,
        });
        if (error) {
          console.warn('[pixelpets] care error:', error.message);
          await reloadCollection();
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = data as any;
        const serverPet = applyDecay(petFromRow(res.pet), Date.now());
        setCol((c) => ({
          ...c,
          pets: c.pets.map((p) => (p.id === id ? serverPet : p)),
          wallet: { ...c.wallet, tokens: Number(res.tokens) },
        }));
      })();
      return;
    }

    // Local-only mode (no Supabase): apply the action and award play locally.
    if (!cloud) {
      setCol((c) => {
        if (!c.activeId) return c;
        const now = Date.now();
        const active = c.pets.find((p) => p.id === c.activeId);
        const pets = c.pets.map((p) =>
          p.id === c.activeId ? applyAction(p, kind, now) : p
        );
        let wallet = c.wallet;
        if (kind === 'play' && active) {
          const d = applyDecay(active, now);
          const ok =
            d.stage !== 'egg' && d.stage !== 'dead' && !d.asleep && d.energy >= 10;
          if (ok) wallet = awardTokens(c.wallet, PLAY_REWARD);
        }
        return { ...c, pets, wallet };
      });
      return;
    }

    // Cloud ascension: locked column, so apply optimistically then persist via
    // the ascend_pet RPC; revert from the cloud if the server rejects.
    setCol((c) => {
      if (!c.activeId) return c;
      return {
        ...c,
        pets: c.pets.map((p) =>
          p.id === c.activeId ? applyAction(p, kind, Date.now()) : p
        ),
      };
    });
    const ascendId = colRef.current.activeId;
    if (ascendId) {
      (async () => {
        const { error } = await supabase!.rpc('ascend_pet', { p_pet_id: ascendId });
        if (error) {
          console.warn('[pixelpets] ascend error:', error.message);
          await reloadCollection();
        }
      })();
    }
  }, [reloadCollection]);

  const trainStat = useCallback((petId: string, stat: StatKey) => {
    if (isSupabaseConfigured) {
      // Server computes the cost, enforces the cap, and deducts tokens.
      (async () => {
        const { data, error } = await supabase!.rpc('train_pet', {
          p_pet_id: petId,
          p_stat: stat,
        });
        if (error) {
          console.warn('[pixelpets] train error:', error.message);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = data as any;
        setCol((c) => ({
          ...c,
          pets: c.pets.map((p) =>
            p.id === petId ? { ...p, stats: res.stats, level: Number(res.level) } : p
          ),
          wallet: { ...c.wallet, tokens: Number(res.tokens) },
        }));
      })();
      return;
    }
    setCol((c) => {
      const pet = c.pets.find((p) => p.id === petId);
      if (!pet) return c;
      if (!canTrain(pet)) return c; // at this life stage's level cap
      const cost = trainCost(stat, pet.stats[stat]);
      if (c.wallet.tokens < cost) return c;
      const cap = STAGE_LEVEL_CAP[pet.stage];
      const pets = c.pets.map((p) =>
        p.id === petId
          ? {
              ...p,
              stats: { ...p.stats, [stat]: p.stats[stat] + STAT_INCREMENT[stat] },
              level: Math.min(cap, (p.level ?? 1) + 1),
            }
          : p
      );
      return { ...c, pets, wallet: { ...c.wallet, tokens: c.wallet.tokens - cost } };
    });
  }, []);

  // Add tokens outside the daily play cap (local mode only — battle rewards).
  const grantTokens = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCol((c) => ({
      ...c,
      wallet: { ...c.wallet, tokens: c.wallet.tokens + amount },
    }));
  }, []);

  // Sync the wallet to an authoritative balance returned by a server RPC
  // (e.g. resolve_battle). Display-only; the sync no longer writes tokens.
  const setWalletTokens = useCallback((tokens: number) => {
    setCol((c) => ({ ...c, wallet: { ...c.wallet, tokens } }));
  }, []);

  const renamePet = useCallback((id: string, name: string) => {
    const clean = name.trim().slice(0, 16);
    if (!clean) return;
    setCol((c) => ({
      ...c,
      pets: c.pets.map((p) => (p.id === id ? { ...p, name: clean } : p)),
    }));
    // `name` is the one care/identity column still client-writable; persist it
    // directly since the periodic sync no longer writes pet columns.
    if (isSupabaseConfigured) {
      (async () => {
        const { error } = await supabase!
          .from('pets')
          .update({ name: clean })
          .eq('id', id);
        if (error) console.warn('[pixelpets] rename error:', error.message);
      })();
    }
  }, []);

  // Merge the found local pets into the current collection (keeping any pets
  // already in the cloud), then stop offering import. Capped at MAX_PETS.
  const importLocalPets = useCallback(() => {
    const uid = userRef.current;
    setImportable((local) => {
      if (!local) return null;
      const now = Date.now();
      const sanitized = local.pets.map((p) => migratePet(p));
      if (isSupabaseConfigured) {
        // Direct inserts are locked down, so push the legacy pets through the
        // import RPC, then reload the authoritative collection from the cloud.
        (async () => {
          const { error } = await supabase!.rpc('import_pets', { p_pets: sanitized });
          if (error) console.warn('[pixelpets] import error:', error.message);
          await reloadCollection();
        })();
      } else {
        setCol((c) => {
          const byId = new Map(c.pets.map((p) => [p.id, p]));
          for (const p of sanitized) if (!byId.has(p.id)) byId.set(p.id, p);
          const merged = Array.from(byId.values())
            .slice(0, MAX_PETS)
            .map((p) => applyDecay(p, now));
          return {
            pets: merged,
            activeId: c.activeId ?? merged[0]?.id ?? null,
            wallet: c.wallet,
          };
        });
      }
      if (uid) AsyncStorage.setItem(importedKey(uid), '1').catch(() => {});
      return null;
    });
  }, [reloadCollection]);

  const skipImport = useCallback(() => {
    const uid = userRef.current;
    if (uid) AsyncStorage.setItem(importedKey(uid), '1').catch(() => {});
    setImportable(null);
  }, []);

  const activePet = col.pets.find((p) => p.id === col.activeId) ?? null;

  return {
    pets: col.pets,
    activePet,
    activeId: col.activeId,
    tokens: col.wallet.tokens,
    loaded,
    importablePets: importable?.pets ?? null,
    hatch,
    switchPet,
    removePet,
    renamePet,
    trainStat,
    grantTokens,
    setWalletTokens,
    reloadCollection,
    importablePetsCount: importable?.pets.length ?? 0,
    importLocalPets,
    skipImport,
    act,
    canBattleActive,
    spendBattleEnergy,
  };
};

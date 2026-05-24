import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PetState,
  ActionKind,
  LifeStage,
  Rarity,
  BattleStats,
  StatKey,
  DRAGON_SPECIES,
} from '../types';

const STORAGE_PREFIX_V1 = '@pixelpets/pet/v1/';   // legacy single-pet save
const STORAGE_PREFIX_V2 = '@pixelpets/pets/v2/';  // collection of pets
const v1Key = (userId: string) => `${STORAGE_PREFIX_V1}${userId}`;
const v2Key = (userId: string) => `${STORAGE_PREFIX_V2}${userId}`;

export const MAX_PETS = 8;

// Only full-body emoji — face-only emoji (🐶 🐱 🦁 etc.) are intentionally
// excluded so every newly hatched pet shows as a recognizable creature
// rather than a floating head.
const SPECIES_BY_RARITY: Record<Rarity, readonly string[]> = {
  common:    ['🐕', '🐈', '🐇', '🐀', '🐦', '🐢', '🐠'],
  uncommon:  ['🦊', '🦝', '🦨', '🐍', '🦎', '🦇', '🦔', '🐧'],
  rare:      ['🦡', '🦌', '🦥', '🦉', '🦅', '🦘', '🦦', '🦫'],
  epic:      ['🐅', '🐘', '🦏', '🐊', '🦈', '🦒', '🦚', '🦬'],
  legendary: ['🐉', '🦄', '🧜', '🦖', '🦕', '🐙'],
};

const LEGACY_RARITY: Record<string, Rarity> = {
  '🐶': 'common',  '🐱': 'common',  '🐰': 'common',
  '🐭': 'common',  '🐹': 'common',  '🐁': 'common', // 🐁 retired from the pool
  '🐸': 'uncommon',
  '🐺': 'rare',    '🐼': 'rare',    '🐨': 'rare',
  '🦁': 'epic',    '🐯': 'epic',    '🦛': 'epic',
  '🐲': 'legendary',
};

// Human-readable name for each species emoji, used in the UI.
const SPECIES_NAMES: Record<string, string> = {
  '🐕': 'Dog',     '🐈': 'Cat',      '🐇': 'Rabbit',  '🐁': 'Mouse',
  '🐀': 'Rat',     '🐦': 'Bird',     '🐢': 'Turtle',  '🐠': 'Fish',
  '🦊': 'Fox',     '🦝': 'Raccoon',  '🦨': 'Skunk',   '🐍': 'Snake',
  '🦎': 'Lizard',  '🦇': 'Bat',      '🦔': 'Hedgehog','🐧': 'Penguin',
  '🦡': 'Badger',  '🦌': 'Deer',     '🦥': 'Sloth',   '🦉': 'Owl',
  '🦅': 'Eagle',   '🦘': 'Kangaroo', '🦦': 'Otter',   '🦫': 'Beaver',
  '🐅': 'Tiger',   '🐘': 'Elephant', '🦏': 'Rhino',   '🐊': 'Crocodile',
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

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Naming an egg one of these (case-insensitive) guarantees that species
// at hatch instead of a random roll. Easter eggs.
const SPECIAL_NAMES: Record<string, { species: string; rarity: Rarity }> = {
  spyro: { species: DRAGON_SPECIES, rarity: 'legendary' },
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

// Level grows with age and is capped. A pure function of the pet's age.
export const petLevel = (pet: PetState): number =>
  Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, pet.age) / SECONDS_PER_LEVEL));

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
  return next;
};

const TICK_MS = 10000;

// Life-stage thresholds (seconds since birth).
export const STAGE_BABY_AT = 30;      // 30s — egg hatches
const STAGE_CHILD_AT = 7200;   // 2 hr
const STAGE_TEEN_AT = 28800;   // 8 hr
const STAGE_ADULT_AT = 86400;  // 24 hr

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

// A dragon may ascend once it reaches adulthood. One-way, terminal upgrade.
export const canAscend = (pet: PetState): boolean =>
  pet.species === DRAGON_SPECIES && pet.stage === 'adult' && !pet.ascended;

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
const STARTING_TOKENS = 25; // small welcome balance so training is tryable

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

export const usePet = (userId: string | null) => {
  const [col, setCol] = useState<Collection>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const colRef = useRef<Collection>(col);
  const userRef = useRef<string | null>(userId);

  useEffect(() => {
    colRef.current = col;
  }, [col]);

  useEffect(() => {
    userRef.current = userId;
    if (!userId) {
      setCol(EMPTY);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const loaded = await loadCollection(userId);
      if (cancelled) return;
      setCol({
        pets: loaded.pets.map((p) => applyDecay(p, Date.now())),
        activeId: loaded.activeId,
        wallet: loaded.wallet,
      });
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !loaded) return;
    AsyncStorage.setItem(v2Key(userId), JSON.stringify(col)).catch(() => {});
  }, [col, userId, loaded]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = colRef.current;
      if (current.pets.length === 0) return;
      setCol((c) => tickAll(c, Date.now()));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hatch = useCallback((name: string) => {
    if (!userRef.current) return;
    setCol((c) => {
      if (c.pets.length >= MAX_PETS) return c;
      const pet = createPet(name);
      return { ...c, pets: [...c.pets, pet], activeId: pet.id };
    });
  }, []);

  const switchPet = useCallback((id: string) => {
    setCol((c) => (c.pets.some((p) => p.id === id) ? { ...c, activeId: id } : c));
  }, []);

  const removePet = useCallback((id: string) => {
    setCol((c) => {
      const remaining = c.pets.filter((p) => p.id !== id);
      const activeId =
        c.activeId === id ? remaining[0]?.id ?? null : c.activeId;
      return { ...c, pets: remaining, activeId };
    });
  }, []);

  const act = useCallback((kind: ActionKind) => {
    setCol((c) => {
      if (!c.activeId) return c;
      const now = Date.now();
      const active = c.pets.find((p) => p.id === c.activeId);
      const pets = c.pets.map((p) =>
        p.id === c.activeId ? applyAction(p, kind, now) : p
      );
      // A successful PLAY earns Pixel tokens (up to the daily cap).
      let wallet = c.wallet;
      if (kind === 'play' && active) {
        const d = applyDecay(active, now);
        const played =
          d.stage !== 'egg' && d.stage !== 'dead' && !d.asleep && d.energy >= 10;
        if (played) wallet = awardTokens(c.wallet, PLAY_REWARD);
      }
      return { ...c, pets, wallet };
    });
  }, []);

  const trainStat = useCallback((petId: string, stat: StatKey) => {
    setCol((c) => {
      const pet = c.pets.find((p) => p.id === petId);
      if (!pet) return c;
      const cost = trainCost(stat, pet.stats[stat]);
      if (c.wallet.tokens < cost) return c;
      const pets = c.pets.map((p) =>
        p.id === petId
          ? { ...p, stats: { ...p.stats, [stat]: p.stats[stat] + STAT_INCREMENT[stat] } }
          : p
      );
      return { ...c, pets, wallet: { ...c.wallet, tokens: c.wallet.tokens - cost } };
    });
  }, []);

  // Add tokens outside the daily play cap (e.g. battle rewards).
  const grantTokens = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCol((c) => ({
      ...c,
      wallet: { ...c.wallet, tokens: c.wallet.tokens + amount },
    }));
  }, []);

  const renamePet = useCallback((id: string, name: string) => {
    const clean = name.trim().slice(0, 16);
    if (!clean) return;
    setCol((c) => ({
      ...c,
      pets: c.pets.map((p) => (p.id === id ? { ...p, name: clean } : p)),
    }));
  }, []);

  const activePet = col.pets.find((p) => p.id === col.activeId) ?? null;

  return {
    pets: col.pets,
    activePet,
    activeId: col.activeId,
    tokens: col.wallet.tokens,
    loaded,
    hatch,
    switchPet,
    removePet,
    renamePet,
    trainStat,
    grantTokens,
    act,
  };
};

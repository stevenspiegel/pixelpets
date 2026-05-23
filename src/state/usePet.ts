import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PetState, ActionKind, LifeStage, Rarity } from '../types';

const STORAGE_PREFIX_V1 = '@pixelpets/pet/v1/';   // legacy single-pet save
const STORAGE_PREFIX_V2 = '@pixelpets/pets/v2/';  // collection of pets
const v1Key = (userId: string) => `${STORAGE_PREFIX_V1}${userId}`;
const v2Key = (userId: string) => `${STORAGE_PREFIX_V2}${userId}`;

export const MAX_PETS = 8;

// Only full-body emoji — face-only emoji (🐶 🐱 🦁 etc.) are intentionally
// excluded so every newly hatched pet shows as a recognizable creature
// rather than a floating head.
const SPECIES_BY_RARITY: Record<Rarity, readonly string[]> = {
  common:    ['🐕', '🐈', '🐇', '🐁', '🐀', '🐦', '🐢', '🐠'],
  uncommon:  ['🦊', '🦝', '🦨', '🐍', '🦎', '🦇', '🦔', '🐧'],
  rare:      ['🦡', '🦌', '🦥', '🦉', '🦅', '🦘', '🦦', '🦫'],
  epic:      ['🐅', '🐘', '🦏', '🐊', '🦈', '🦒', '🦚', '🦬'],
  legendary: ['🐉', '🦄', '🧜', '🦖', '🦕', '🐙'],
};

const LEGACY_RARITY: Record<string, Rarity> = {
  '🐶': 'common',  '🐱': 'common',  '🐰': 'common',
  '🐭': 'common',  '🐹': 'common',
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

const rollSpecies = (): { species: string; rarity: Rarity } => {
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

const makeId = () =>
  `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const migratePet = (pet: PetState): PetState => {
  let next = pet;
  if (!next.rarity) next = { ...next, rarity: rarityForSpecies(next.species) };
  if (!next.id) next = { ...next, id: makeId() };
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
  const { species, rarity } = rollSpecies();
  return {
    id: makeId(),
    name: name || 'Pixel',
    species,
    rarity,
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

const applyAction = (pet: PetState, kind: ActionKind, now: number): PetState => {
  if (pet.stage === 'dead' || pet.stage === 'egg') return pet;
  const base = applyDecay(pet, now);
  switch (kind) {
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

type Collection = {
  pets: PetState[];
  activeId: string | null;
};

const EMPTY: Collection = { pets: [], activeId: null };

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
      const parsed = JSON.parse(v2) as Collection;
      const migrated = parsed.pets.map(migratePet);
      const validActive = migrated.find((p) => p.id === parsed.activeId)?.id
        ?? migrated[0]?.id
        ?? null;
      return { pets: migrated, activeId: validActive };
    }
    // Legacy migration: a single-pet v1 save becomes a one-element collection.
    const v1 = await AsyncStorage.getItem(v1Key(userId));
    if (v1) {
      const pet = migratePet(JSON.parse(v1) as PetState);
      return { pets: [pet], activeId: pet.id };
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
      return { pets: [...c.pets, pet], activeId: pet.id };
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
      return { pets: remaining, activeId };
    });
  }, []);

  const act = useCallback((kind: ActionKind) => {
    setCol((c) => {
      if (!c.activeId) return c;
      const now = Date.now();
      const pets = c.pets.map((p) =>
        p.id === c.activeId ? applyAction(p, kind, now) : p
      );
      return { ...c, pets };
    });
  }, []);

  const activePet = col.pets.find((p) => p.id === col.activeId) ?? null;

  return {
    pets: col.pets,
    activePet,
    activeId: col.activeId,
    loaded,
    hatch,
    switchPet,
    removePet,
    act,
  };
};

import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PetState, ActionKind, LifeStage, Rarity } from '../types';

const STORAGE_PREFIX = '@pixelpets/pet/v1/';
const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

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

// Legacy face-only emoji from earlier hatches — kept solely so old saves
// classify into the right tier. New hatches only draw from SPECIES_BY_RARITY.
const LEGACY_RARITY: Record<string, Rarity> = {
  '🐶': 'common',  '🐱': 'common',  '🐰': 'common',
  '🐭': 'common',  '🐹': 'common',
  '🐸': 'uncommon',
  '🐺': 'rare',    '🐼': 'rare',    '🐨': 'rare',
  '🦁': 'epic',    '🐯': 'epic',    '🦛': 'epic',
  '🐲': 'legendary',
};

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

const migratePet = (pet: PetState): PetState => {
  if (pet.rarity) return pet;
  return { ...pet, rarity: rarityForSpecies(pet.species) };
};

// How often the UI re-applies decay while the app is foregrounded.
const TICK_MS = 10000;

// Life-stage thresholds (seconds since birth).
const STAGE_BABY_AT = 300;     // 5 min — egg hatches
const STAGE_CHILD_AT = 7200;   // 2 hr
const STAGE_TEEN_AT = 28800;   // 8 hr
const STAGE_ADULT_AT = 86400;  // 24 hr

// Per-active-second stat drain rates (out of 100).
const HUNGER_DRAIN = 0.01;     // ~2.8 hr full → empty
const HAPPINESS_DRAIN = 0.008; // ~3.5 hr
const CLEAN_DRAIN = 0.005;     // ~5.5 hr
const ENERGY_DRAIN = 0.007;    // ~4 hr
const ENERGY_GAIN_SLEEPING = 0.03; // full energy from a ~55 min nap
const POOP_INTERVAL_SEC = 3600;    // one poop every ~1 hr of active time

const HEALTH_DRAIN_HUNGRY = 0.012;
const HEALTH_DRAIN_SAD = 0.006;
const HEALTH_DRAIN_DIRTY = 0.005;
const HEALTH_DRAIN_SICK = 0.008;
const HEALTH_RECOVER_HAPPY = 0.003;

// Per scaled-second probability of getting sick when poops have piled up.
const SICK_RATE = 0.0002;

// When a tick gap exceeds OFFLINE_THRESHOLD_SEC (browser closed, tab
// backgrounded, machine asleep) only OFFLINE_MULTIPLIER of the extra time
// counts toward decay. e.g. with threshold=30s and multiplier=0.1, an hour
// away ≈ 30s + (3600-30)*0.1 ≈ 6.5 min of in-game decay.
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

  // Age uses raw elapsed — the pet keeps growing up even while you're away.
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

  // Poops accumulate as a fractional counter; the UI floors for display.
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

export const usePet = (userId: string | null) => {
  const [pet, setPet] = useState<PetState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const petRef = useRef<PetState | null>(null);
  const userRef = useRef<string | null>(userId);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    userRef.current = userId;
    if (!userId) {
      setPet(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(userId));
        if (cancelled) return;
        if (raw) {
          const parsed: PetState = migratePet(JSON.parse(raw));
          setPet(applyDecay(parsed, Date.now()));
        } else {
          setPet(null);
        }
      } catch {
        if (!cancelled) setPet(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!pet || !userId) return;
    AsyncStorage.setItem(storageKey(userId), JSON.stringify(pet)).catch(() => {});
  }, [pet, userId]);

  useEffect(() => {
    const id = setInterval(() => {
      const current = petRef.current;
      if (!current || current.stage === 'dead') return;
      setPet(applyDecay(current, Date.now()));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hatch = useCallback((name: string) => {
    if (!userRef.current) return;
    setPet(createPet(name));
  }, []);

  const reset = useCallback(() => {
    const uid = userRef.current;
    setPet(null);
    if (uid) AsyncStorage.removeItem(storageKey(uid)).catch(() => {});
  }, []);

  const act = useCallback((kind: ActionKind) => {
    setPet((current) => {
      if (!current || current.stage === 'dead') return current;
      if (current.stage === 'egg') return current;
      const now = Date.now();
      const base = applyDecay(current, now);
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
    });
  }, []);

  return { pet, loaded, hatch, act, reset };
};

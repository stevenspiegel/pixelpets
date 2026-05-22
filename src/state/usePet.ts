import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PetState, ActionKind, LifeStage, Rarity } from '../types';

const STORAGE_PREFIX = '@pixelpets/pet/v1/';
const TICK_MS = 4000;
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

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

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
  if (ageSeconds < 20) return 'egg';
  if (ageSeconds < 120) return 'baby';
  if (ageSeconds < 360) return 'child';
  if (ageSeconds < 900) return 'teen';
  return 'adult';
};

const applyDecay = (pet: PetState, now: number): PetState => {
  if (pet.stage === 'dead') return pet;
  const elapsedSec = Math.max(0, (now - pet.lastTick) / 1000);
  if (elapsedSec < 0.5) return pet;

  const sleepMultiplier = pet.asleep ? 0.25 : 1;
  const next: PetState = { ...pet };

  next.age = pet.age + elapsedSec;
  next.stage = stageFromAge(next.age);

  if (next.stage === 'egg') {
    next.lastTick = now;
    return next;
  }

  next.hunger = clamp(pet.hunger - elapsedSec * 0.9 * sleepMultiplier);
  next.happiness = clamp(pet.happiness - elapsedSec * 0.7 * sleepMultiplier);
  next.cleanliness = clamp(pet.cleanliness - elapsedSec * 0.4);
  next.energy = pet.asleep
    ? clamp(pet.energy + elapsedSec * 2.5)
    : clamp(pet.energy - elapsedSec * 0.6);

  const ticks = Math.floor(elapsedSec / 25);
  if (ticks > 0 && !pet.asleep) {
    next.poops = pet.poops + ticks;
  }

  if (next.poops >= 2 && Math.random() < 0.05) {
    next.sick = true;
  }

  let healthDelta = 0;
  if (next.hunger <= 0) healthDelta -= elapsedSec * 1.2;
  if (next.happiness <= 0) healthDelta -= elapsedSec * 0.6;
  if (next.cleanliness <= 0) healthDelta -= elapsedSec * 0.5;
  if (next.sick) healthDelta -= elapsedSec * 0.8;
  if (
    next.hunger > 60 &&
    next.happiness > 60 &&
    next.cleanliness > 60 &&
    !next.sick
  ) {
    healthDelta += elapsedSec * 0.3;
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

import { PetState, Rarity } from '../types';
import { battleStats, speciesName, PIXEDEX_TIERS } from '../state/usePet';
import { Combatant } from './engine';

// Wild opponents are drawn from the full hatchable roster. Derived from
// PIXEDEX_TIERS (the Pixedex catalog) so the opponent pool can never drift
// from the species you can actually hatch. Ascension-only mythical forms are
// excluded since they aren't hatchable.
const RARITY_BY_SPECIES: Record<string, Rarity> = Object.fromEntries(
  PIXEDEX_TIERS.flatMap(({ rarity, species }) =>
    species.map((s) => [s, rarity] as const),
  ),
);

const OPPONENT_SPECIES = Object.keys(RARITY_BY_SPECIES);

const ADJECTIVES = ['Wild', 'Feral', 'Rival', 'Rogue', 'Fierce', 'Ancient'];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Build a combatant scaled to roughly match the player's effective stats,
// with per-stat jitter so fights aren't identical.
export const generateOpponent = (playerPet: PetState): Combatant => {
  const ps = battleStats(playerPet);
  const species = pick(OPPONENT_SPECIES);
  const jitter = () => 0.8 + Math.random() * 0.35; // 0.8–1.15
  const attack = Math.max(1, Math.round(ps.attack * jitter()));
  const defense = Math.max(1, Math.round(ps.defense * jitter()));
  const speed = Math.max(1, Math.round(ps.speed * jitter()));
  const maxHp = Math.max(10, Math.round(ps.maxHp * (0.85 + Math.random() * 0.3)));
  return {
    name: `${pick(ADJECTIVES)} ${speciesName(species)}`,
    species,
    stage: 'adult',
    rarity: RARITY_BY_SPECIES[species] ?? 'common',
    ascended: false,
    level: ps.level,
    attack,
    defense,
    speed,
    maxHp,
    hp: maxHp,
    guarding: false,
  };
};

export const playerCombatant = (pet: PetState): Combatant => {
  const ps = battleStats(pet);
  return {
    name: pet.name,
    species: pet.species,
    stage: pet.stage,
    rarity: pet.rarity,
    ascended: pet.ascended,
    level: ps.level,
    attack: ps.attack,
    defense: ps.defense,
    speed: ps.speed,
    maxHp: ps.maxHp,
    hp: ps.maxHp,
    guarding: false,
  };
};

// Token reward for defeating an opponent of the given level. Kept modest so
// saving up for an egg takes some time.
export const battleReward = (enemyLevel: number): number =>
  5 + Math.floor(enemyLevel / 5);

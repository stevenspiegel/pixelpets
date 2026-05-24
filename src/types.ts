export type LifeStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'dead';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Persistent base combat stats, rolled at hatch. A future battle system can
// read these directly or scale them by level (see battleStats in usePet).
export type BattleStats = {
  attack: number;
  defense: number;
  speed: number;
  maxHp: number;
};

export type StatKey = keyof BattleStats;

export type PetState = {
  id: string;
  name: string;
  species: string;
  rarity: Rarity;
  stats: BattleStats;
  level: number; // battle level — raised by training, not age
  stage: LifeStage;
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
  health: number;
  age: number;
  bornAt: number;
  lastTick: number;
  asleep: boolean;
  poops: number;
  sick: boolean;
  // Dragons can ascend once they reach the adult stage. Terminal, one-way.
  ascended?: boolean;
};

export type ActionKind =
  | 'feed'
  | 'play'
  | 'clean'
  | 'sleep'
  | 'wake'
  | 'medicine'
  | 'ascend';

export const DRAGON_SPECIES = '🐉';

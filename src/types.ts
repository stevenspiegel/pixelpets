export type LifeStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'dead';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type PetState = {
  name: string;
  species: string;
  rarity: Rarity;
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
};

export type ActionKind = 'feed' | 'play' | 'clean' | 'sleep' | 'wake' | 'medicine';

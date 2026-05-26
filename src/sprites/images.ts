import { ImageSourcePropType } from 'react-native';
import { LifeStage } from '../types';

// Image-based sprites take priority over the pixel-art grid in ./index.ts.
// Each species maps life stages to bundled PNGs; a stage may be omitted, in
// which case rendering falls back to the grid sprite (or emoji). The special
// 'ascended' key is the post-adult ascended form (dragon, unicorn).
type SpriteKey = LifeStage | 'ascended';
type StageImages = Partial<Record<SpriteKey, ImageSourcePropType>>;

export const IMAGE_SPRITES: Record<string, StageImages> = {
  '🐢': {
    baby: require('../../assets/sprites/turtle-baby.png'),
    child: require('../../assets/sprites/turtle-child.png'),
    teen: require('../../assets/sprites/turtle-teen.png'),
    adult: require('../../assets/sprites/turtle-adult.png'),
  },
  '🐉': {
    baby: require('../../assets/sprites/dragon-baby.png'),
    child: require('../../assets/sprites/dragon-child.png'),
    teen: require('../../assets/sprites/dragon-teen.png'),
    adult: require('../../assets/sprites/dragon-adult.png'),
    ascended: require('../../assets/sprites/dragon-ascended.png'),
  },
  '🦈': {
    baby: require('../../assets/sprites/shark-baby.png'),
    child: require('../../assets/sprites/shark-child.png'),
    teen: require('../../assets/sprites/shark-teen.png'),
    adult: require('../../assets/sprites/shark-adult.png'),
  },
  '🦫': {
    baby: require('../../assets/sprites/beaver-baby.png'),
    child: require('../../assets/sprites/beaver-child.png'),
    teen: require('../../assets/sprites/beaver-teen.png'),
    adult: require('../../assets/sprites/beaver-adult.png'),
  },
  '🦔': {
    baby: require('../../assets/sprites/hedgehog-baby.png'),
    child: require('../../assets/sprites/hedgehog-child.png'),
    teen: require('../../assets/sprites/hedgehog-teen.png'),
    adult: require('../../assets/sprites/hedgehog-adult.png'),
  },
  '🦎': {
    baby: require('../../assets/sprites/lizard-baby.png'),
    child: require('../../assets/sprites/lizard-child.png'),
    teen: require('../../assets/sprites/lizard-teen.png'),
    adult: require('../../assets/sprites/lizard-adult.png'),
  },
  '🐕': {
    baby: require('../../assets/sprites/dog-baby.png'),
    child: require('../../assets/sprites/dog-child.png'),
    teen: require('../../assets/sprites/dog-teen.png'),
    adult: require('../../assets/sprites/dog-adult.png'),
  },
  '🐇': {
    baby: require('../../assets/sprites/rabbit-baby.png'),
    child: require('../../assets/sprites/rabbit-child.png'),
    teen: require('../../assets/sprites/rabbit-teen.png'),
    adult: require('../../assets/sprites/rabbit-adult.png'),
  },
  '🦄': {
    baby: require('../../assets/sprites/unicorn-baby.png'),
    child: require('../../assets/sprites/unicorn-child.png'),
    teen: require('../../assets/sprites/unicorn-teen.png'),
    adult: require('../../assets/sprites/unicorn-adult.png'),
    ascended: require('../../assets/sprites/unicorn-ascended.png'),
  },
};

export const imageSpriteFor = (
  species: string,
  stage: LifeStage,
  ascended = false
): ImageSourcePropType | undefined => {
  const entry = IMAGE_SPRITES[species];
  if (!entry) return undefined;
  if (ascended && entry.ascended) return entry.ascended;
  return entry[stage];
};

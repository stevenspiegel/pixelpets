import { ImageSourcePropType } from 'react-native';
import { LifeStage } from '../types';

// Image-based sprites take priority over the pixel-art grid in ./index.ts.
// Each species maps life stages to bundled PNGs; a stage may be omitted, in
// which case rendering falls back to the grid sprite (or emoji).
type StageImages = Partial<Record<LifeStage, ImageSourcePropType>>;

export const IMAGE_SPRITES: Record<string, StageImages> = {
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
};

export const imageSpriteFor = (
  species: string,
  stage: LifeStage
): ImageSourcePropType | undefined => IMAGE_SPRITES[species]?.[stage];

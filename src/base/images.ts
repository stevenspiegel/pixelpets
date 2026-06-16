import { ImageSourcePropType } from 'react-native';

// PNG art for base decorations, keyed by the decor id in src/state/base.ts.
// When an id has an entry here, BaseScreen renders the image; otherwise it
// falls back to the emoji glyph from the catalog. Drop transparent PNGs into
// assets/base/<id>.png (square, ~64x64 for the 1x1 items) to replace the
// placeholders.
export const DECOR_ART: Record<string, ImageSourcePropType> = {
  fence: require('../../assets/base/fence.png'),
  rock: require('../../assets/base/rock.png'),
  bush: require('../../assets/base/bush.png'),
  bowl: require('../../assets/base/bowl.png'),
  ball: require('../../assets/base/ball.png'),
  flowers: require('../../assets/base/flowers.png'),
  tree: require('../../assets/base/tree.png'),
  lamp: require('../../assets/base/lamp.png'),
  bed: require('../../assets/base/bed.png'),
  pond: require('../../assets/base/pond.png'),
};

export const decorArt = (id: string): ImageSourcePropType | undefined =>
  DECOR_ART[id];

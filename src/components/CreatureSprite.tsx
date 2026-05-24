import React from 'react';
import { Image, Text, StyleSheet } from 'react-native';
import { LifeStage } from '../types';
import { imageSpriteFor } from '../sprites/images';
import { SPRITES, hasSprite } from '../sprites';
import { PixelArt } from './PixelArt';

type Props = {
  species: string;
  stage: LifeStage;
  ascended?: boolean;
  size: number;
};

// Renders a creature using the same priority as the main pet view:
// image sprite → pixel-art grid → emoji fallback. No animations/overlays.
export const CreatureSprite: React.FC<Props> = ({ species, stage, ascended, size }) => {
  const img = imageSpriteFor(species, stage, ascended);
  if (img) {
    return <Image source={img} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  if (hasSprite(species)) {
    return <PixelArt sprite={SPRITES[species]} size={size} />;
  }
  return <Text style={[styles.emoji, { fontSize: size * 0.8, lineHeight: size }]}>{species}</Text>;
};

const styles = StyleSheet.create({
  emoji: {
    textAlign: 'center',
  },
});

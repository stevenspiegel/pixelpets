import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { PetState, Rarity } from '../types';
import { SPRITES, hasSprite } from '../sprites';
import { imageSpriteFor } from '../sprites/images';
import { PixelArt } from './PixelArt';

type Props = {
  pets: PetState[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onAddNew: () => void;
  maxPets: number;
};

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8a8a8a',
  uncommon: '#5fee5f',
  rare: '#5fc0ff',
  epic: '#cc7fff',
  legendary: '#ffd24d',
};

const tileEmoji = (pet: PetState): string => {
  if (pet.stage === 'egg') return '🥚';
  if (pet.stage === 'dead') return '👻';
  return pet.species;
};

export const PetSwitcher: React.FC<Props> = ({
  pets,
  activeId,
  onSwitch,
  onAddNew,
  maxPets,
}) => {
  const canAdd = pets.length < maxPets;
  return (
    <View style={styles.wrap}>
      {pets.map((pet) => {
        const active = pet.id === activeId;
        const color = RARITY_COLOR[pet.rarity];
        return (
          <Pressable
            key={pet.id}
            onPress={() => onSwitch(pet.id)}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: color },
              active && [styles.tileActive, { borderColor: color }],
              pressed && styles.tilePressed,
            ]}
          >
            {pet.stage !== 'egg' &&
            pet.stage !== 'dead' &&
            imageSpriteFor(pet.species, pet.stage, pet.ascended) ? (
              <Image
                source={imageSpriteFor(pet.species, pet.stage, pet.ascended)!}
                style={styles.tileImage}
                resizeMode="contain"
              />
            ) : pet.stage !== 'egg' &&
              pet.stage !== 'dead' &&
              hasSprite(pet.species) ? (
              <PixelArt sprite={SPRITES[pet.species]} size={36} />
            ) : (
              <Text style={styles.emoji}>{tileEmoji(pet)}</Text>
            )}
            <Text
              style={[styles.name, active && styles.nameActive]}
              numberOfLines={1}
            >
              {pet.name}
            </Text>
          </Pressable>
        );
      })}
      {canAdd && (
        <Pressable
          onPress={onAddNew}
          style={({ pressed }) => [
            styles.tile,
            styles.tileAdd,
            pressed && styles.tilePressed,
          ]}
        >
          <Text style={styles.plus}>+</Text>
          <Text style={styles.name}>NEW</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tile: {
    width: 64,
    height: 72,
    marginHorizontal: 4,
    marginVertical: 4,
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    backgroundColor: '#2a1a4a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tileActive: {
    borderWidth: 3,
    backgroundColor: '#3a2070',
  },
  tilePressed: {
    transform: [{ translateY: 1 }],
  },
  tileAdd: {
    borderStyle: 'dashed',
    backgroundColor: '#1a0d2e',
  },
  emoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  tileImage: {
    width: 36,
    height: 36,
  },
  name: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    maxWidth: 56,
  },
  nameActive: {
    color: '#fff',
  },
  plus: {
    fontSize: 28,
    lineHeight: 36,
    color: '#7a4ed0',
    fontWeight: 'bold',
  },
});

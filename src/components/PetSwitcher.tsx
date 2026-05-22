import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { PetState, Rarity } from '../types';

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
  switch (pet.stage) {
    case 'egg': return '🥚';
    case 'baby': return '🐣';
    case 'child': return '🐤';
    case 'teen': return '🐥';
    case 'dead': return '👻';
    default: return pet.species;
  }
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
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
            <Text style={styles.emoji}>{tileEmoji(pet)}</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tile: {
    width: 64,
    height: 72,
    marginHorizontal: 4,
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

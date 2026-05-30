import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { PetState } from '../types';
import { CreatureSprite } from './CreatureSprite';
import { speciesName } from '../state/usePet';

type Props = {
  username: string;
  pets: PetState[];
  onImport: () => void;
  onSkip: () => void;
};

export const ImportScreen: React.FC<Props> = ({ username, pets, onImport, onSkip }) => {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>WELCOME BACK</Text>
      <Text style={styles.subtitle}>@{username}</Text>
      <Text style={styles.body}>
        We found {pets.length} pet{pets.length === 1 ? '' : 's'} saved on this
        device. Import {pets.length === 1 ? 'it' : 'them'} into your account?
      </Text>

      <View style={styles.grid}>
        {pets.map((pet) => (
          <View key={pet.id} style={styles.card}>
            <CreatureSprite
              species={pet.species}
              stage={pet.stage === 'egg' || pet.stage === 'dead' ? 'adult' : pet.stage}
              ascended={pet.ascended}
              size={56}
            />
            <Text style={styles.petName} numberOfLines={1}>
              {pet.name}
            </Text>
            <Text style={styles.petKind}>{speciesName(pet.species)}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onImport}
        style={({ pressed }) => [styles.importBtn, pressed && styles.pressed]}
      >
        <Text style={styles.importText}>IMPORT MY PETS</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
        <Text style={styles.skipText}>start fresh instead</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 3,
    ...(Platform.select({
      web: { textShadow: '2px 2px 0 #7a4ed0' },
      default: {
        textShadowColor: '#7a4ed0',
        textShadowOffset: { width: 2, height: 2 },
      },
    }) as object),
  },
  subtitle: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    marginTop: 2,
    marginBottom: 16,
  },
  body: {
    color: '#e0d4ff',
    fontFamily: 'Courier',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 340,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 360,
    marginBottom: 24,
  },
  card: {
    width: 84,
    alignItems: 'center',
    margin: 6,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 8,
  },
  petName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
    maxWidth: 76,
  },
  petKind: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 9,
    letterSpacing: 1,
  },
  importBtn: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  pressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#e23a5a',
  },
  importText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  skipBtn: {
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1,
  },
});

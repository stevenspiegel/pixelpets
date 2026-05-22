import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { PetState } from '../types';

type Props = {
  pet: PetState;
};

const stageEmoji = (pet: PetState): string => {
  switch (pet.stage) {
    case 'baby':
      return '🐣';
    case 'child':
      return '🐤';
    case 'teen':
      return '🐥';
    case 'adult':
      return pet.species;
    case 'dead':
      return '👻';
    default:
      return '🥚';
  }
};

const moodEmoji = (pet: PetState): string | null => {
  if (pet.stage === 'egg' || pet.stage === 'dead') return null;
  if (pet.asleep) return '💤';
  if (pet.sick) return '🤒';
  if (pet.hunger < 25) return '🍽️';
  if (pet.cleanliness < 25) return '🦨';
  if (pet.happiness < 25) return '😢';
  if (pet.energy < 20) return '😴';
  if (pet.happiness > 75 && pet.hunger > 50) return '✨';
  return null;
};

export const Pet: React.FC<Props> = ({ pet }) => {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: pet.asleep ? 1800 : 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: pet.asleep ? 1800 : 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, pet.asleep]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: pet.stage === 'egg' ? [0, -6] : [0, -10],
  });

  const mood = moodEmoji(pet);

  return (
    <View style={styles.wrap}>
      {pet.stage === 'egg' ? (
        <Animated.View style={[styles.eggBox, { transform: [{ translateY }] }]}>
          <Image
            source={require('../../assets/egg.gif')}
            style={styles.egg}
            resizeMode="contain"
          />
        </Animated.View>
      ) : (
        <Animated.Text
          style={[
            styles.sprite,
            pet.stage === 'baby' && styles.spriteSmall,
            pet.stage === 'child' && styles.spriteMedium,
            { transform: [{ translateY }] },
          ]}
        >
          {stageEmoji(pet)}
        </Animated.Text>
      )}
      {mood && <Text style={styles.mood}>{mood}</Text>}
      {pet.poops > 0 && pet.stage !== 'egg' && pet.stage !== 'dead' && (
        <View style={styles.poopRow}>
          {Array.from({ length: Math.min(pet.poops, 4) }).map((_, i) => (
            <Text key={i} style={styles.poop}>💩</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    position: 'relative',
  },
  eggBox: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  egg: {
    width: 180,
    height: 180,
  },
  sprite: {
    fontSize: 140,
    lineHeight: 160,
  },
  spriteSmall: {
    fontSize: 90,
    lineHeight: 110,
  },
  spriteMedium: {
    fontSize: 115,
    lineHeight: 135,
  },
  mood: {
    position: 'absolute',
    top: 10,
    right: 30,
    fontSize: 34,
  },
  poopRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
  },
  poop: {
    fontSize: 22,
    marginHorizontal: 2,
  },
});

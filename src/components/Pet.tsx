import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { PetState } from '../types';
import { STAGE_BABY_AT, effectiveRarity } from '../state/usePet';
import { SPRITES, hasSprite } from '../sprites';
import { imageSpriteFor } from '../sprites/images';
import { PixelArt } from './PixelArt';

type Props = {
  pet: PetState;
};

const SPRITE_SIZE_BY_STAGE: Record<string, number> = {
  baby: 96,
  child: 128,
  teen: 160,
  adult: 168,
};

// Length of the egg-hatch GIF (assets/egg-hatch.gif): 14 frames × 130ms. We play
// it once at the egg→baby crossing, then reveal the pet — so the reveal is gated
// for exactly one loop of the animation.
const HATCH_ANIM_MS = 1820;

const stageEmoji = (pet: PetState): string => {
  if (pet.stage === 'dead') return '👻';
  if (pet.stage === 'egg') return '🥚';
  // baby, child, teen, adult all show the actual species — sized
  // differently per stage so the pet still visibly grows up.
  return pet.species;
};

const formatHatchRemaining = (secondsLeft: number) => {
  const s = Math.max(0, Math.ceil(secondsLeft));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toString().padStart(2, '0')}s`;
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

const SPARKLE_OFFSETS: { x: number; y: number; delay: number }[] = [
  { x: -70, y: -30, delay: 0 },
  { x: 70, y: -10, delay: 400 },
  { x: -50, y: 50, delay: 800 },
  { x: 60, y: 60, delay: 1200 },
];

export const Pet: React.FC<Props> = ({ pet }) => {
  const bob = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  // Play the hatch GIF once when the egg actually hatches (egg→baby), then
  // reveal the pet. We only trigger on the live transition — a Pet that mounts
  // already past the egg stage (e.g. after an app reload) skips straight to the
  // reveal, no replay.
  const prevStage = useRef(pet.stage);
  const [hatching, setHatching] = useState(false);
  useEffect(() => {
    const was = prevStage.current;
    prevStage.current = pet.stage;
    if (was === 'egg' && pet.stage !== 'egg' && pet.stage !== 'dead') {
      setHatching(true);
      const t = setTimeout(() => setHatching(false), HATCH_ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [pet.stage]);

  const rarity = effectiveRarity(pet);
  const showSparkles =
    pet.stage !== 'egg' &&
    pet.stage !== 'dead' &&
    !hatching &&
    (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythical');

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

  useEffect(() => {
    if (!showSparkles) return;
    const loop = Animated.loop(
      Animated.timing(sparkle, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sparkle, showSparkles]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: pet.stage === 'egg' ? [0, -6] : [0, -10],
  });

  const mood = moodEmoji(pet);
  const spriteSize = SPRITE_SIZE_BY_STAGE[pet.stage] ?? 160;
  const imageSource =
    pet.stage !== 'egg' && pet.stage !== 'dead'
      ? imageSpriteFor(pet.species, pet.stage, pet.ascended)
      : undefined;

  return (
    <View style={styles.wrap}>
      {showSparkles &&
        SPARKLE_OFFSETS.map((offset, i) => {
          const phase = (sparkle as unknown as Animated.Value).interpolate({
            inputRange: [0, 1],
            outputRange: [offset.delay / 2000, 1 + offset.delay / 2000],
          });
          const opacity = phase.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5],
            outputRange: [0, 1, 0, 0, 0, 1, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.Text
              key={i}
              style={[
                styles.sparkle,
                {
                  transform: [{ translateX: offset.x }, { translateY: offset.y }],
                  opacity,
                  color:
                    rarity === 'mythical'
                      ? '#ff7af0'
                      : rarity === 'legendary'
                        ? '#ffd24d'
                        : '#cc7fff',
                },
              ]}
            >
              ✨
            </Animated.Text>
          );
        })}
      {pet.stage === 'egg' ? (
        <View style={styles.eggColumn}>
          <Animated.View style={[styles.eggBox, { transform: [{ translateY }] }]}>
            <Image
              source={require('../../assets/egg.gif')}
              style={styles.egg}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.hatchProgress}>
            <View style={styles.hatchTrack}>
              <View
                style={[
                  styles.hatchFill,
                  {
                    width: `${Math.min(100, (pet.age / STAGE_BABY_AT) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.hatchLabel}>
              Hatching in {formatHatchRemaining(STAGE_BABY_AT - pet.age)}
            </Text>
          </View>
        </View>
      ) : hatching ? (
        // One-shot hatch animation, played between the timer finishing and the
        // pet being revealed (its length is HATCH_ANIM_MS).
        <View style={styles.eggBox}>
          <Image
            source={require('../../assets/egg-hatch.gif')}
            style={styles.egg}
            resizeMode="contain"
          />
        </View>
      ) : imageSource ? (
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Image
            source={imageSource}
            style={{ width: spriteSize, height: spriteSize }}
            resizeMode="contain"
          />
        </Animated.View>
      ) : hasSprite(pet.species) && pet.stage !== 'dead' ? (
        <Animated.View style={{ transform: [{ translateY }] }}>
          <PixelArt sprite={SPRITES[pet.species]} size={spriteSize} />
        </Animated.View>
      ) : pet.stage === 'dead' ? (
        <Animated.Image
          source={require('../../assets/ghost.png')}
          style={{ width: spriteSize, height: spriteSize, transform: [{ translateY }] }}
          resizeMode="contain"
        />
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
      {!hatching && mood && <Text style={styles.mood}>{mood}</Text>}
      {Math.floor(pet.poops) > 0 && pet.stage !== 'egg' && pet.stage !== 'dead' && (
        <View style={styles.poopRow}>
          {Array.from({ length: Math.min(Math.floor(pet.poops), 4) }).map((_, i) => (
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
  eggColumn: {
    alignItems: 'center',
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
  hatchProgress: {
    width: 220,
    marginTop: 4,
    alignItems: 'center',
  },
  hatchTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#2a1a4a',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0d0620',
  },
  hatchFill: {
    height: '100%',
    backgroundColor: '#ffd24d',
  },
  hatchLabel: {
    fontFamily: 'Courier',
    color: '#2a1a4a',
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: 'bold',
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
  sparkle: {
    position: 'absolute',
    fontSize: 22,
  },
});

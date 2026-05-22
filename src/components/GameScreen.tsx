import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { PetState, ActionKind } from '../types';
import { Pet } from './Pet';
import { StatBar } from './StatBar';
import { ActionButton } from './ActionButton';
import { RarityBadge } from './RarityBadge';

type Props = {
  pet: PetState;
  username: string;
  onAct: (kind: ActionKind) => void;
  onReset: () => void;
  onLogOut: () => void;
};

const formatAge = (seconds: number) => {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const confirmReset = (onReset: () => void) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm('Start over with a new egg?')) {
      onReset();
    }
    return;
  }
  Alert.alert('Start Over?', 'This will release your current pet.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: onReset },
  ]);
};

export const GameScreen: React.FC<Props> = ({
  pet,
  username,
  onAct,
  onReset,
  onLogOut,
}) => {
  const status = useMemo(() => {
    if (pet.stage === 'dead') return 'has passed away…';
    if (pet.stage === 'egg') return 'is incubating…';
    if (pet.asleep) return 'is sleeping';
    if (pet.sick) return 'is feeling sick';
    if (pet.hunger < 25) return 'is hungry';
    if (pet.cleanliness < 25) return 'needs a bath';
    if (pet.happiness < 25) return 'is sad';
    if (pet.energy < 20) return 'is sleepy';
    return 'is doing great!';
  }, [pet]);

  const isEgg = pet.stage === 'egg';
  const isDead = pet.stage === 'dead';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.trainer}>@{username}</Text>
        <Pressable onPress={onLogOut} hitSlop={8}>
          <Text style={styles.logout}>LOG OUT</Text>
        </Pressable>
      </View>
      <View style={styles.header}>
        <Text style={styles.name}>{pet.name.toUpperCase()}</Text>
        <Text style={styles.stageText}>
          {pet.stage.toUpperCase()} · {formatAge(pet.age)}
        </Text>
        {!isEgg && <RarityBadge rarity={pet.rarity} />}
      </View>

      <View style={styles.tama}>
        <View style={styles.screen}>
          <Pet pet={pet} />
          <Text style={styles.status}>
            {pet.name} {status}
          </Text>
        </View>

        {!isEgg && !isDead && (
          <View style={styles.statsBlock}>
            <StatBar label="HUNGER" icon="🍖" color="#ffa040" value={pet.hunger} />
            <StatBar label="HAPPY" icon="❤️" color="#ff5fa2" value={pet.happiness} />
            <StatBar label="CLEAN" icon="🧼" color="#5fc0ff" value={pet.cleanliness} />
            <StatBar label="ENERGY" icon="⚡" color="#ffe34d" value={pet.energy} />
            <StatBar label="HEALTH" icon="💊" color="#7fee7f" value={pet.health} />
          </View>
        )}

        {isEgg && (
          <Text style={styles.hint}>
            Your egg is incubating. Come back in a few minutes!
          </Text>
        )}

        {isDead && (
          <Text style={[styles.hint, styles.deadHint]}>
            {pet.name} lived for {formatAge(pet.age)}. Rest in pixels.
          </Text>
        )}
      </View>

      {!isEgg && !isDead && (
        <View style={styles.actions}>
          <ActionButton
            icon="🍔"
            label="FEED"
            onPress={() => onAct('feed')}
            disabled={pet.asleep}
          />
          <ActionButton
            icon="🎮"
            label="PLAY"
            onPress={() => onAct('play')}
            disabled={pet.asleep || pet.energy < 10}
          />
          <ActionButton
            icon="🚿"
            label="CLEAN"
            onPress={() => onAct('clean')}
          />
          <ActionButton
            icon={pet.asleep ? '☀️' : '🌙'}
            label={pet.asleep ? 'WAKE' : 'SLEEP'}
            onPress={() => onAct(pet.asleep ? 'wake' : 'sleep')}
          />
          <ActionButton
            icon="💊"
            label="MEDS"
            onPress={() => onAct('medicine')}
            disabled={!pet.sick}
          />
        </View>
      )}

      <Pressable onPress={() => confirmReset(onReset)} style={styles.resetButton}>
        <Text style={styles.resetText}>
          {isDead ? 'NEW EGG' : 'reset'}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 16,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  trainer: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1,
  },
  logout: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 3,
    textShadowColor: '#7a4ed0',
    textShadowOffset: { width: 2, height: 2 },
  },
  stageText: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 2,
  },
  tama: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#3a2070',
    borderWidth: 4,
    borderColor: '#7a4ed0',
    borderRadius: 24,
    padding: 14,
  },
  screen: {
    backgroundColor: '#cfe9c8',
    borderWidth: 4,
    borderColor: '#0d0620',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  status: {
    fontFamily: 'Courier',
    color: '#2a1a4a',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  statsBlock: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  hint: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  deadHint: {
    color: '#ff9bb3',
  },
  actions: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  resetButton: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
  },
});

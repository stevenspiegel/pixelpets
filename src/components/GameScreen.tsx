import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { PetState, ActionKind, StatKey } from '../types';
import { Pet } from './Pet';
import { StatBar } from './StatBar';
import { ActionButton } from './ActionButton';
import { RarityBadge } from './RarityBadge';
import { PetSwitcher } from './PetSwitcher';
import { BattleStats } from './BattleStats';
import { MAX_PETS, speciesName, canAscend } from '../state/usePet';

type Props = {
  pet: PetState;
  pets: PetState[];
  username: string;
  tokens: number;
  onAct: (kind: ActionKind) => void;
  onSwitchPet: (id: string) => void;
  onAddNew: () => void;
  onRemove: () => void;
  onRename: (id: string, name: string) => void;
  onTrain: (stat: StatKey) => void;
  onBattle: () => void;
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

const confirmRemove = (petName: string, onRemove: () => void) => {
  const msg = `Release ${petName}? This cannot be undone.`;
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(msg)) {
      onRemove();
    }
    return;
  }
  Alert.alert('Release pet?', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Release', style: 'destructive', onPress: onRemove },
  ]);
};

export const GameScreen: React.FC<Props> = ({
  pet,
  pets,
  username,
  tokens,
  onAct,
  onSwitchPet,
  onAddNew,
  onRemove,
  onRename,
  onTrain,
  onBattle,
  onLogOut,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  // Leave edit mode when switching to a different pet.
  useEffect(() => {
    setEditingName(false);
  }, [pet.id]);

  const startRename = () => {
    setDraftName(pet.name);
    setEditingName(true);
  };

  const saveRename = () => {
    const clean = draftName.trim();
    if (clean) onRename(pet.id, clean);
    setEditingName(false);
  };

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
  const ascendable = canAscend(pet);
  const stageLabel = pet.ascended ? 'ASCENDED' : pet.stage.toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.trainer}>@{username}</Text>
        <View style={styles.walletChip}>
          <Text style={styles.walletText}>✦ {tokens}</Text>
        </View>
        <Pressable onPress={onLogOut} hitSlop={8}>
          <Text style={styles.logout}>LOG OUT</Text>
        </Pressable>
      </View>
      <View style={styles.switcherWrap}>
        <PetSwitcher
          pets={pets}
          activeId={pet.id}
          onSwitch={onSwitchPet}
          onAddNew={onAddNew}
          maxPets={MAX_PETS}
        />
      </View>
      <View style={styles.header}>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              style={styles.nameInput}
              maxLength={16}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={saveRename}
              returnKeyType="done"
            />
            <Pressable onPress={saveRename} hitSlop={10}>
              <Text style={styles.nameSave}>✓</Text>
            </Pressable>
            <Pressable onPress={() => setEditingName(false)} hitSlop={10}>
              <Text style={styles.nameCancel}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={isEgg ? undefined : startRename}
            style={styles.nameRow}
            disabled={isEgg}
          >
            <Text style={styles.name}>{pet.name.toUpperCase()}</Text>
            {!isEgg && <Text style={styles.pencil}> ✎</Text>}
          </Pressable>
        )}
        <Text style={styles.stageText}>
          {stageLabel}
          {!isEgg ? ` · ${speciesName(pet.species).toUpperCase()}` : ''} ·{' '}
          {formatAge(pet.age)}
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
            <BattleStats pet={pet} tokens={tokens} onTrain={onTrain} />
          </View>
        )}

        {isDead && (
          <Text style={[styles.hint, styles.deadHint]}>
            {pet.name} lived for {formatAge(pet.age)}. Rest in pixels.
          </Text>
        )}
      </View>

      {ascendable && (
        <Pressable
          onPress={() => onAct('ascend')}
          style={({ pressed }) => [
            styles.ascendButton,
            pressed && styles.ascendButtonPressed,
          ]}
        >
          <Text style={styles.ascendText}>✨ ASCEND ✨</Text>
          <Text style={styles.ascendSub}>your dragon is ready to transcend</Text>
        </Pressable>
      )}

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

      {!isEgg && !isDead && (
        <Pressable
          onPress={onBattle}
          style={({ pressed }) => [
            styles.battleButton,
            pressed && styles.battleButtonPressed,
          ]}
        >
          <Text style={styles.battleText}>⚔️ BATTLE</Text>
          <Text style={styles.battleSub}>fight a wild challenger for ✦ tokens</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => confirmRemove(pet.name, onRemove)}
        style={styles.resetButton}
      >
        <Text style={styles.resetText}>
          {isDead ? `bury ${pet.name.toLowerCase()}` : `release ${pet.name.toLowerCase()}`}
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
  walletChip: {
    backgroundColor: '#3a2070',
    borderWidth: 2,
    borderColor: '#ffd24d',
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  walletText: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  logout: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  switcherWrap: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  pencil: {
    color: '#8a76c0',
    fontSize: 16,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 160,
    textAlign: 'center',
  },
  nameSave: {
    color: '#7fee7f',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  nameCancel: {
    color: '#ff8aa3',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
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
  ascendButton: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    backgroundColor: '#6a4a0a',
    borderWidth: 3,
    borderColor: '#ffd24d',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ascendButtonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#8a6310',
  },
  ascendText: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  ascendSub: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 1,
  },
  battleButton: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    backgroundColor: '#7a1f3a',
    borderWidth: 3,
    borderColor: '#ff5470',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  battleButtonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#9a2a4a',
  },
  battleText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  battleSub: {
    color: '#ffd0db',
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 1,
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

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PetState, StatKey } from '../types';
import { battleStats, trainCost, STAT_INCREMENT, stageLevelCap, canTrain } from '../state/usePet';

type Props = {
  pet: PetState;
  tokens: number;
  onTrain: (stat: StatKey) => void;
};

const CHIPS: { key: StatKey; icon: string; label: string }[] = [
  { key: 'attack', icon: '⚔️', label: 'ATK' },
  { key: 'defense', icon: '🛡️', label: 'DEF' },
  { key: 'speed', icon: '👟', label: 'SPD' },
  { key: 'maxHp', icon: '❤️', label: 'HP' },
];

export const BattleStats: React.FC<Props> = ({ pet, tokens, onTrain }) => {
  const stats = battleStats(pet);
  const cap = stageLevelCap(pet.stage);
  const atCap = !canTrain(pet);
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>BATTLE STATS</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>
            LV {stats.level}
            {cap < 50 ? ` / ${cap}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {CHIPS.map((c) => {
          const cost = trainCost(c.key, pet.stats[c.key]);
          const enabled = tokens >= cost && !atCap;
          return (
            <View key={c.key} style={styles.chip}>
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={styles.chipLabel}>{c.label}</Text>
              <Text style={styles.chipValue}>{stats[c.key]}</Text>
              <Pressable
                onPress={() => onTrain(c.key)}
                disabled={!enabled}
                style={({ pressed }) => [
                  styles.trainBtn,
                  !enabled && styles.trainBtnDisabled,
                  pressed && enabled && styles.trainBtnPressed,
                ]}
              >
                <Text style={[styles.trainInc, !enabled && styles.trainTextDim]}>
                  +{STAT_INCREMENT[c.key]}
                </Text>
                <Text style={[styles.trainCost, !enabled && styles.trainTextDim]}>
                  ✦{cost}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {atCap
          ? `Max level for this stage — grow up to train more`
          : `spend ✦ Pixel tokens to train · earn by playing`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  levelBadge: {
    backgroundColor: '#7a4ed0',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    flex: 1,
    marginHorizontal: 2,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#0d0620',
    borderRadius: 4,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 1,
  },
  chipValue: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trainBtn: {
    backgroundColor: '#3a2070',
    borderWidth: 1,
    borderColor: '#7a4ed0',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  trainBtnDisabled: {
    opacity: 0.4,
  },
  trainBtnPressed: {
    backgroundColor: '#5a30a0',
  },
  trainInc: {
    color: '#7fee7f',
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trainCost: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trainTextDim: {
    color: '#8a76c0',
  },
  hint: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 1,
  },
});

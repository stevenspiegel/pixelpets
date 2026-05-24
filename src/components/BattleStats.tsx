import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PetState } from '../types';
import { battleStats } from '../state/usePet';

type Props = {
  pet: PetState;
};

const CHIPS: { key: 'attack' | 'defense' | 'speed' | 'maxHp'; icon: string; label: string }[] = [
  { key: 'attack', icon: '⚔️', label: 'ATK' },
  { key: 'defense', icon: '🛡️', label: 'DEF' },
  { key: 'speed', icon: '👟', label: 'SPD' },
  { key: 'maxHp', icon: '❤️', label: 'HP' },
];

export const BattleStats: React.FC<Props> = ({ pet }) => {
  const stats = battleStats(pet);
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>BATTLE STATS</Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>LV {stats.level}</Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {CHIPS.map((c) => (
          <View key={c.key} style={styles.chip}>
            <Text style={styles.chipIcon}>{c.icon}</Text>
            <Text style={styles.chipLabel}>{c.label}</Text>
            <Text style={styles.chipValue}>{stats[c.key]}</Text>
          </View>
        ))}
      </View>
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
  },
});

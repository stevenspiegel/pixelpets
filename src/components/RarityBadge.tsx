import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Rarity } from '../types';

type Props = {
  rarity: Rarity;
};

const RARITY_COLORS: Record<Rarity, { bg: string; border: string; text: string }> = {
  common:    { bg: '#4a4a4a', border: '#8a8a8a', text: '#e0e0e0' },
  uncommon:  { bg: '#1f5a1f', border: '#5fee5f', text: '#c5ffc5' },
  rare:      { bg: '#1f3a6a', border: '#5fc0ff', text: '#cfe9ff' },
  epic:      { bg: '#4a1f6a', border: '#cc7fff', text: '#eed4ff' },
  legendary: { bg: '#6a4a0a', border: '#ffd24d', text: '#ffe9a0' },
  mythical:  { bg: '#5a0a4a', border: '#ff7af0', text: '#ffd6fb' },
};

const ORNAMENT: Partial<Record<Rarity, string>> = {
  legendary: '★',
  mythical: '✦',
};

export const RarityBadge: React.FC<Props> = ({ rarity }) => {
  const color = RARITY_COLORS[rarity];
  const ornament = ORNAMENT[rarity];
  return (
    <View style={[styles.wrap, { backgroundColor: color.bg, borderColor: color.border }]}>
      {ornament && <Text style={[styles.text, { color: color.text }]}>{ornament} </Text>}
      <Text style={[styles.text, { color: color.text }]}>{rarity.toUpperCase()}</Text>
      {ornament && <Text style={[styles.text, { color: color.text }]}> {ornament}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  text: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

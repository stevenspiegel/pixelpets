import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { PIXEDEX_TIERS, PIXEDEX_TOTAL, speciesName } from '../state/usePet';
import { fetchDiscoveredSpecies } from '../state/pixedex';
import { CreatureSprite } from './CreatureSprite';
import { Rarity } from '../types';

type Props = {
  onExit: () => void;
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  mythical: 'MYTHICAL',
};

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b8c0cc',
  uncommon: '#7fee7f',
  rare: '#7fc6ff',
  epic: '#c98bff',
  legendary: '#ffd24d',
  mythical: '#ff8aa3',
};

export const PixedexScreen: React.FC<Props> = ({ onExit }) => {
  const [discovered, setDiscovered] = useState<Set<string> | null>(null);

  useEffect(() => {
    let active = true;
    fetchDiscoveredSpecies().then((list) => {
      if (active) setDiscovered(new Set(list));
    });
    return () => {
      active = false;
    };
  }, []);

  const found = discovered ? discovered.size : 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>📖 PIXEDEX</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      {discovered === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      ) : (
        <>
          <Text style={styles.counter}>
            {found} / {PIXEDEX_TOTAL} species discovered
          </Text>

          {PIXEDEX_TIERS.map((tier) => (
            <View key={tier.rarity} style={styles.tier}>
              <Text style={[styles.tierLabel, { color: RARITY_COLOR[tier.rarity] }]}>
                {RARITY_LABEL[tier.rarity]}
              </Text>
              <View style={styles.grid}>
                {tier.species.map((sp) => {
                  const owned = discovered.has(sp);
                  return (
                    <View
                      key={sp}
                      style={[styles.card, owned && { borderColor: RARITY_COLOR[tier.rarity] }]}
                    >
                      {owned ? (
                        <CreatureSprite species={sp} stage="adult" size={56} />
                      ) : (
                        <Text style={styles.unknownMark}>?</Text>
                      )}
                      <Text style={styles.name} numberOfLines={1}>
                        {owned ? speciesName(sp) : '???'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={styles.hint}>
            Hatch, adopt, or import pets to fill out your Pixedex. Discoveries stay
            even if a pet is released.
          </Text>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  counter: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  tier: { marginBottom: 18 },
  tierLabel: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: {
    width: 88,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#3a2a5a',
    borderRadius: 6,
    paddingVertical: 6,
  },
  unknownMark: {
    fontSize: 40,
    color: '#5a4a7a',
    fontFamily: 'Courier',
    fontWeight: 'bold',
    height: 56,
    lineHeight: 56,
  },
  name: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 4,
  },
  hint: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
  },
});

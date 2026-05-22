import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  value: number;
  icon: string;
  color: string;
};

export const StatBar: React.FC<Props> = ({ label, value, icon, color }) => {
  const pct = Math.max(0, Math.min(100, value));
  const warn = pct < 25;
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.barBox}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: warn ? '#ff5470' : color },
            ]}
          />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  icon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  barBox: {
    flex: 1,
    marginLeft: 6,
  },
  barTrack: {
    height: 12,
    backgroundColor: '#2a1a4a',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0d0620',
  },
  barFill: {
    height: '100%',
  },
  label: {
    color: '#e0d4ff',
    fontSize: 10,
    fontFamily: 'Courier',
    marginTop: 2,
    letterSpacing: 1,
  },
});

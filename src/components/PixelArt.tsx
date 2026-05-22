import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PALETTE } from '../sprites/palette';

type Props = {
  sprite: readonly string[];
  size: number;
};

// Renders a square pixel-art sprite as a grid of single-color cells.
// `sprite` is an array of equal-length strings, one character per pixel.
// Unknown characters fall back to transparent.
export const PixelArt: React.FC<Props> = React.memo(({ sprite, size }) => {
  const rows = sprite.length;
  const cols = sprite[0]?.length ?? rows;
  const cell = size / cols;
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {sprite.map((row, y) => (
        <View key={y} style={[styles.row, { height: cell }]}>
          {row.split('').map((ch, x) => {
            const color = PALETTE[ch] ?? 'transparent';
            if (color === 'transparent') {
              return <View key={x} style={{ width: cell, height: cell }} />;
            }
            return (
              <View
                key={x}
                style={{ width: cell, height: cell, backgroundColor: color }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
});

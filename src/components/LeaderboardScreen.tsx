import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchLeaderboard, LeaderRow } from '../battle/pvp';

type Props = {
  username: string;
  onExit: () => void;
};

export const LeaderboardScreen: React.FC<Props> = ({ username, onExit }) => {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchLeaderboard().then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🏆 LEADERBOARD</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      {rows === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No PvP battles yet. Be the first!</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cellRank, styles.head]}>#</Text>
            <Text style={[styles.cellName, styles.head]}>PLAYER</Text>
            <Text style={[styles.cellNum, styles.head]}>W</Text>
            <Text style={[styles.cellNum, styles.head]}>L</Text>
          </View>
          {rows.map((r, i) => {
            const me = r.username === username;
            return (
              <View key={r.username} style={[styles.row, me && styles.meRow]}>
                <Text style={[styles.cellRank, me && styles.meText]}>{i + 1}</Text>
                <Text style={[styles.cellName, me && styles.meText]} numberOfLines={1}>
                  @{r.username}
                </Text>
                <Text style={[styles.cellNum, styles.win]}>{r.wins}</Text>
                <Text style={[styles.cellNum, styles.loss]}>{r.losses}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, alignItems: 'center' },
  topBar: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  exit: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  empty: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    marginTop: 30,
    textAlign: 'center',
  },
  table: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a2070',
  },
  headerRow: {
    backgroundColor: '#3a2070',
  },
  meRow: {
    backgroundColor: '#3a2070',
  },
  head: {
    color: '#8a76c0',
    fontSize: 11,
  },
  cellRank: {
    width: 28,
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cellName: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
  },
  cellNum: {
    width: 36,
    textAlign: 'center',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
  },
  meText: {
    color: '#ffd24d',
  },
  win: { color: '#7fee7f' },
  loss: { color: '#ff8aa3' },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import {
  QUESTS,
  QuestId,
  DailyStatus,
  fetchDailyStatus,
  claimQuest,
  questProgress,
  questComplete,
  checkinReward,
} from '../state/daily';

type Props = {
  onWalletChange?: (tokens: number) => void;
  onExit: () => void;
};

export const DailyScreen: React.FC<Props> = ({ onWalletChange, onExit }) => {
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<QuestId | null>(null);
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const s = await fetchDailyStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onClaim = useCallback(
    async (id: QuestId) => {
      if (claiming || !status) return;
      setClaiming(id);
      const res = await claimQuest(id);
      setClaiming(null);
      if (!res || 'error' in res) {
        setFlash(res && 'error' in res ? res.error : 'Could not claim — try again.');
        return;
      }
      setFlash(`+✦ ${res.reward} tokens!`);
      setStatus((s) =>
        s ? { ...s, claimed: res.claimed, streak: res.streak, tokens: res.tokens } : s
      );
      onWalletChange?.(res.tokens);
    },
    [claiming, status, onWalletChange]
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>📅 DAILY</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      {loading || !status ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.streakBox}>
            <Text style={styles.streakNum}>🔥 {status.streak}</Text>
            <Text style={styles.streakLabel}>
              day streak{'\n'}check in daily to keep it alive
            </Text>
          </View>

          {flash !== '' && <Text style={styles.flash}>{flash}</Text>}

          {QUESTS.map((q) => {
            const claimed = status.claimed.includes(q.id);
            const complete = questComplete(q, status);
            const reward =
              q.id === 'checkin' ? checkinReward(status.streak, claimed) : q.reward;
            return (
              <View key={q.id} style={styles.quest}>
                <Text style={styles.qIcon}>{q.icon}</Text>
                <View style={styles.qBody}>
                  <Text style={styles.qLabel}>{q.label}</Text>
                  <Text style={styles.qDesc}>
                    {q.id === 'checkin'
                      ? q.desc
                      : `${q.desc}  (${Math.min(questProgress(q, status), q.target)}/${q.target})`}
                  </Text>
                  <Text style={styles.qReward}>+✦ {reward} tokens</Text>
                </View>
                {claimed ? (
                  <View style={[styles.claimBtn, styles.claimed]}>
                    <Text style={styles.claimedText}>DONE ✓</Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={!complete || claiming !== null}
                    onPress={() => onClaim(q.id)}
                    style={({ pressed }) => [
                      styles.claimBtn,
                      complete ? styles.ready : styles.locked,
                      pressed && complete && styles.claimPressed,
                    ]}
                  >
                    {claiming === q.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.claimText}>{complete ? 'CLAIM' : '…'}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}

          <Text style={styles.footnote}>Quests reset each day (UTC).</Text>
        </>
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
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 18, fontWeight: 'bold', letterSpacing: 3 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  streakBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#3a2070',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 6,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakNum: { color: '#ffd24d', fontFamily: 'Courier', fontSize: 30, fontWeight: 'bold', marginRight: 14 },
  streakLabel: { color: '#d6c8ff', fontFamily: 'Courier', fontSize: 12, lineHeight: 17, flexShrink: 1 },
  flash: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quest: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  qIcon: { fontSize: 26, marginRight: 10 },
  qBody: { flex: 1 },
  qLabel: { color: '#fff', fontFamily: 'Courier', fontSize: 13, fontWeight: 'bold' },
  qDesc: { color: '#bfa8f0', fontFamily: 'Courier', fontSize: 11, marginTop: 2 },
  qReward: { color: '#ffe9a0', fontFamily: 'Courier', fontSize: 11, fontWeight: 'bold', marginTop: 3 },
  claimBtn: {
    minWidth: 72,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  ready: { backgroundColor: '#ff5470', borderWidth: 2, borderColor: '#fff' },
  locked: { backgroundColor: '#241640', borderWidth: 2, borderColor: '#4a3570' },
  claimed: { backgroundColor: '#241640', borderWidth: 2, borderColor: '#4a8a3a' },
  claimPressed: { transform: [{ translateY: 2 }] },
  claimText: { color: '#fff', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  claimedText: { color: '#7fee7f', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold' },
  footnote: { color: '#8a7ab0', fontFamily: 'Courier', fontSize: 10, marginTop: 6 },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SLOT_SYMBOLS, SLOT_BET, spinSlots, SpinResult } from '../state/slots';
import { CreatureSprite } from './CreatureSprite';

type Props = {
  tokens: number;
  onWalletChange: (tokens: number) => void;
  onExit: () => void;
};

// Payout table (mirrors slot_spin triple_pay + two-of-a-kind). symbol = index
// into SLOT_SYMBOLS for a triple; null = the "any two match" row.
const PAYOUTS: { symbol: number | null; pay: string }[] = [
  { symbol: 4, pay: '160' }, // dragon
  { symbol: 3, pay: '130' }, // shark
  { symbol: 2, pay: '100' }, // owl
  { symbol: 1, pay: '70' },  // fox
  { symbol: 0, pay: '40' },  // dog
  { symbol: null, pay: '10' }, // any two match
];

export const SlotsScreen: React.FC<Props> = ({ tokens, onWalletChange, onExit }) => {
  // Display reels (indices into SLOT_SYMBOLS); animate while spinning.
  const [reels, setReels] = useState<[number, number, number]>([0, 1, 2]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const spin = async () => {
    if (spinning || tokens < SLOT_BET) return;
    setSpinning(true);
    setError(null);
    setResult(null);
    // Roll the display fast while we wait for the server.
    tickRef.current = setInterval(() => {
      setReels([
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
        Math.floor(Math.random() * SLOT_SYMBOLS.length),
      ]);
    }, 80);

    const res = await spinSlots();

    // Let it whir for a beat so it feels like a spin, then settle on the result.
    setTimeout(() => {
      if (tickRef.current) clearInterval(tickRef.current);
      setSpinning(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReels(res.value.reels);
      setResult(res.value);
      onWalletChange(res.value.tokens);
    }, 700);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🎰 SLOTS</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>
      <Text style={styles.wallet}>you have ✦ {tokens}</Text>

      <View style={styles.machine}>
        <View style={styles.reelRow}>
          {reels.map((r, i) => (
            <View key={i} style={styles.reel}>
              <CreatureSprite
                species={SLOT_SYMBOLS[r].species}
                stage={SLOT_SYMBOLS[r].stage}
                size={56}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.resultBox}>
        {error ? (
          <Text style={styles.lose}>{error}</Text>
        ) : spinning ? (
          <Text style={styles.spinning}>spinning…</Text>
        ) : result ? (
          result.payout > 0 ? (
            <Text style={styles.win}>
              {result.payout >= 40 ? '🎉 JACKPOT! ' : '✨ WIN! '}+✦ {result.payout}
            </Text>
          ) : (
            <Text style={styles.lose}>no match — try again!</Text>
          )
        ) : (
          <Text style={styles.idle}>spin to win!</Text>
        )}
      </View>

      <Pressable
        onPress={spin}
        disabled={spinning || tokens < SLOT_BET}
        style={({ pressed }) => [
          styles.spinBtn,
          (spinning || tokens < SLOT_BET) && styles.spinBtnDisabled,
          pressed && styles.spinBtnPressed,
        ]}
      >
        <Text style={styles.spinBtnText}>
          {tokens < SLOT_BET ? 'NOT ENOUGH TOKENS' : `SPIN · ✦ ${SLOT_BET}`}
        </Text>
      </Pressable>

      <View style={styles.payTable}>
        <Text style={styles.payHeader}>PAYOUTS</Text>
        {PAYOUTS.map((p, idx) => (
          <View key={idx} style={styles.payRow}>
            {p.symbol === null ? (
              <Text style={styles.payLabel}>any two match</Text>
            ) : (
              <View style={styles.paySymbols}>
                {[0, 1, 2].map((k) => (
                  <CreatureSprite
                    key={k}
                    species={SLOT_SYMBOLS[p.symbol!].species}
                    stage={SLOT_SYMBOLS[p.symbol!].stage}
                    size={22}
                  />
                ))}
              </View>
            )}
            <Text style={styles.payValue}>✦ {p.pay}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  wallet: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 14,
    marginBottom: 16,
  },
  machine: {
    backgroundColor: '#2a1a4a',
    borderWidth: 4,
    borderColor: '#7a4ed0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  reelRow: { flexDirection: 'row', gap: 10 },
  reel: {
    width: 80,
    height: 90,
    backgroundColor: '#0d0620',
    borderWidth: 3,
    borderColor: '#ffd24d',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBox: { height: 30, justifyContent: 'center', marginBottom: 10 },
  idle: { color: '#8a76c0', fontFamily: 'Courier', fontSize: 14, letterSpacing: 1 },
  spinning: { color: '#d6c8ff', fontFamily: 'Courier', fontSize: 14, letterSpacing: 2 },
  win: { color: '#7fee7f', fontFamily: 'Courier', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  lose: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 14, letterSpacing: 1 },
  spinBtn: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    marginBottom: 20,
  },
  spinBtnPressed: { backgroundColor: '#e23a5a', transform: [{ translateY: 2 }] },
  spinBtnDisabled: { backgroundColor: '#4a3a5a', borderColor: '#6a5a7a', opacity: 0.7 },
  spinBtnText: { color: '#fff', fontFamily: 'Courier', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  payTable: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#2a1a4a',
    borderRadius: 8,
    padding: 12,
  },
  payHeader: {
    color: '#bfa8f0',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  paySymbols: { flexDirection: 'row', gap: 2 },
  payLabel: { color: '#d6c8ff', fontFamily: 'Courier', fontSize: 13 },
  payValue: { color: '#ffd24d', fontFamily: 'Courier', fontSize: 13, fontWeight: 'bold' },
});

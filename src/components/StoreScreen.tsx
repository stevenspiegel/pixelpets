import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { BUNDLES, startCheckout } from '../state/purchases';

type Props = {
  tokens: number;
  onExit: () => void;
};

export const StoreScreen: React.FC<Props> = ({ tokens, onExit }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const buy = useCallback(async (id: string) => {
    if (busy) return;
    setBusy(id);
    setError('');
    const url = await startCheckout(id);
    if (!url) {
      setError('Could not start checkout. Please try again.');
      setBusy(null);
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url; // redirect to Stripe's hosted page
    } else {
      setBusy(null);
    }
  }, [busy]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>💎 STORE</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      <Text style={styles.balance}>You have ✦ {tokens} tokens</Text>
      {error !== '' && <Text style={styles.error}>{error}</Text>}

      {BUNDLES.map((b) => (
        <View key={b.id} style={styles.bundle}>
          <View style={styles.bundleInfo}>
            <View style={styles.bundleHeader}>
              <Text style={styles.bundleTokens}>✦ {b.tokens}</Text>
              {b.tag && <Text style={styles.tag}>{b.tag}</Text>}
            </View>
            <Text style={styles.bundleLabel}>{b.label}</Text>
          </View>
          <Pressable
            onPress={() => buy(b.id)}
            disabled={busy !== null}
            style={({ pressed }) => [styles.buyBtn, pressed && styles.buyPressed, busy !== null && styles.buyDisabled]}
          >
            {busy === b.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buyText}>{b.price}</Text>
            )}
          </Pressable>
        </View>
      ))}

      <Text style={styles.footnote}>Secure checkout by Stripe. Tokens are added to your account after payment. All sales are final — Pixel Tokens are a virtual in-game item with no cash value and are non-refundable.</Text>
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
    marginBottom: 10,
  },
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 18, fontWeight: 'bold', letterSpacing: 3 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  balance: { color: '#ffe9a0', fontFamily: 'Courier', fontSize: 13, fontWeight: 'bold', marginBottom: 14 },
  error: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  bundle: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 6,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bundleInfo: { flex: 1 },
  bundleHeader: { flexDirection: 'row', alignItems: 'center' },
  bundleTokens: { color: '#fff', fontFamily: 'Courier', fontSize: 20, fontWeight: 'bold' },
  tag: {
    color: '#0d0620',
    backgroundColor: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 8,
    overflow: 'hidden',
  },
  bundleLabel: { color: '#bfa8f0', fontFamily: 'Courier', fontSize: 12, marginTop: 3 },
  buyBtn: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 86,
    alignItems: 'center',
    marginLeft: 12,
  },
  buyPressed: { transform: [{ translateY: 2 }] },
  buyDisabled: { opacity: 0.5 },
  buyText: { color: '#fff', fontFamily: 'Courier', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  footnote: { color: '#8a7ab0', fontFamily: 'Courier', fontSize: 10, marginTop: 8, textAlign: 'center', maxWidth: 360, lineHeight: 15 },
});

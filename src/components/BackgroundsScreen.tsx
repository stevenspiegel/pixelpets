import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  BACKGROUNDS,
  backgroundImage,
  fetchBackgrounds,
  unlockBackground,
  setActiveBackground,
} from '../state/backgrounds';

type Props = {
  tokens: number;
  // Reflect server-side token/equip changes back into app state.
  onWalletChange: (tokens: number) => void;
  onActiveChange: (id: string) => void;
  onExit: () => void;
};

export const BackgroundsScreen: React.FC<Props> = ({
  tokens,
  onWalletChange,
  onActiveChange,
  onExit,
}) => {
  const [owned, setOwned] = useState<string[] | null>(null);
  const [active, setActive] = useState('default');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetchBackgrounds().then(({ owned, active }) => {
      if (on) {
        setOwned(owned);
        setActive(active);
      }
    });
    return () => {
      on = false;
    };
  }, []);

  const onEquip = async (id: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    const res = await setActiveBackground(id);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setActive(id);
    onActiveChange(id);
  };

  const onUnlock = async (id: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    const res = await unlockBackground(id);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOwned(res.value.owned);
    onWalletChange(res.value.tokens);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🖼️ BACKGROUNDS</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>
      <Text style={styles.wallet}>you have ✦ {tokens}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {owned === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      ) : (
        <View style={styles.grid}>
          {BACKGROUNDS.map((bg) => {
            const isOwned = bg.price === 0 || owned.includes(bg.id);
            const isActive = active === bg.id;
            const img = backgroundImage(bg.id);
            const working = busy === bg.id;
            return (
              <View key={bg.id} style={[styles.card, isActive && styles.cardActive]}>
                <View style={styles.preview}>
                  {img ? (
                    <Image source={img} style={styles.previewImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.previewImg, styles.previewDefault]} />
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {bg.name}
                </Text>
                {isActive ? (
                  <Text style={styles.equipped}>EQUIPPED</Text>
                ) : isOwned ? (
                  <Pressable
                    onPress={() => onEquip(bg.id)}
                    disabled={working}
                    style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.btnText}>{working ? '…' : 'EQUIP'}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => onUnlock(bg.id)}
                    disabled={working || tokens < bg.price}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnBuy,
                      (working || tokens < bg.price) && styles.btnDisabled,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.btnText}>{working ? '…' : `✦ ${bg.price}`}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.hint}>
        Backgrounds appear behind your pet on the home screen. Unlock with tokens
        earned from play and battles.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  wallet: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  error: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: {
    width: 150,
    alignItems: 'center',
    margin: 6,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#3a2a5a',
    borderRadius: 8,
    padding: 8,
  },
  cardActive: { borderColor: '#ffd24d' },
  preview: {
    width: 130,
    height: 130,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0d0620',
  },
  previewImg: { width: '100%', height: '100%' },
  previewDefault: { backgroundColor: '#cfe9c8' },
  name: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 6,
  },
  equipped: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 4,
  },
  btn: {
    marginTop: 6,
    backgroundColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  btnBuy: { backgroundColor: '#ff5470' },
  btnPressed: { opacity: 0.8 },
  btnDisabled: { backgroundColor: '#4a3a5a', opacity: 0.7 },
  btnText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  hint: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
  },
});

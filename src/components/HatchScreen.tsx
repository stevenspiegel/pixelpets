import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

type Props = {
  username: string;
  onHatch: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onLogOut: () => void;
  tokens: number;
  cost: number;
  onCancel?: () => void;
  onMarketplace?: () => void;
};

export const HatchScreen: React.FC<Props> = ({
  username,
  onHatch,
  onLogOut,
  tokens,
  cost,
  onCancel,
  onMarketplace,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const affordable = tokens >= cost;

  const submit = async () => {
    if (busy || !affordable) return;
    setBusy(true);
    setError(null);
    const res = await onHatch(name.trim() || 'Pixel');
    setBusy(false);
    if (!res.ok) setError(res.error);
  };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <View style={styles.topBar}>
        <Text style={styles.trainer}>@{username}</Text>
        <Pressable onPress={onLogOut} hitSlop={8}>
          <Text style={styles.logout}>LOG OUT</Text>
        </Pressable>
      </View>
      <Image
        source={require('../../assets/header.png')}
        style={styles.header}
        resizeMode="contain"
        accessibilityLabel="Pixel Pets"
      />
      <Text style={styles.subtitle}>Hatch and grow your digital pet!</Text>
      <Image
        source={require('../../assets/egg.gif')}
        style={styles.egg}
        resizeMode="contain"
      />
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>EGG</Text>
        <Text style={styles.priceValue}>✦ {cost}</Text>
      </View>
      <Text style={styles.balance}>you have ✦ {tokens}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name your pet"
        placeholderTextColor="#8a76c0"
        style={styles.input}
        maxLength={16}
        autoCapitalize="words"
      />
      <Pressable
        onPress={submit}
        disabled={!affordable || busy}
        style={({ pressed }) => [
          styles.button,
          (!affordable || busy) && styles.buttonDisabled,
          affordable && !busy && pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? 'HATCHING…' : `GET AN EGG · ✦ ${cost}`}
        </Text>
      </Pressable>
      {error && <Text style={styles.hint}>{error}</Text>}
      {!affordable && (
        <Text style={styles.hint}>
          Not enough tokens — win battles and play to earn more, or adopt a pet
          from the marketplace!
        </Text>
      )}
      {onMarketplace && (
        <Pressable onPress={onMarketplace} style={styles.cancel} hitSlop={8}>
          <Text style={styles.cancelText}>🛒 adopt from the marketplace</Text>
        </Pressable>
      )}
      {onCancel && (
        <Pressable onPress={onCancel} style={styles.cancel} hitSlop={8}>
          <Text style={styles.cancelText}>← back to my pets</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    // Reserve the grass band (~150px, drawn behind by App) so the content
    // centers in the visible sky instead of the full viewport — otherwise it
    // reads as a big empty void above the logo with grass filling the bottom.
    paddingBottom: 140,
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainer: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1,
  },
  logout: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  header: {
    width: 280,
    height: 60,
    marginBottom: 14,
  },
  subtitle: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    marginBottom: 18,
  },
  egg: {
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  priceLabel: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  priceValue: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  balance: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 14,
  },
  input: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#2a1a4a',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Courier',
    marginBottom: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#e23a5a',
  },
  buttonDisabled: {
    backgroundColor: '#4a3a5a',
    borderColor: '#6a5a7a',
    opacity: 0.7,
  },
  hint: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 300,
    lineHeight: 18,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cancel: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
  },
});

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
  ActivityIndicator,
} from 'react-native';
import { AuthResult } from '../state/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

type Props = {
  onLogIn: (username: string, password: string) => Promise<AuthResult>;
  onSignUp: (username: string, password: string) => Promise<AuthResult>;
};

type Mode = 'login' | 'signup';

export const LoginScreen: React.FC<Props> = ({ onLogIn, onSignUp }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const action = mode === 'login' ? onLogIn : onSignUp;
    const result = await action(username, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <Image
        source={require('../../assets/header.png')}
        style={styles.header}
        resizeMode="contain"
      />
      <Text style={styles.subtitle}>
        {mode === 'login' ? 'Welcome back!' : 'Create your trainer account'}
      </Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => {
            setMode('login');
            setError(null);
          }}
          style={[styles.tab, mode === 'login' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
            LOG IN
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode('signup');
            setError(null);
          }}
          style={[styles.tab, mode === 'signup' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
            SIGN UP
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor="#8a76c0"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!busy}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#8a76c0"
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={64}
        editable={!busy}
        onSubmitEditing={submit}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          pressed && !busy && styles.buttonPressed,
          busy && styles.buttonDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'login' ? 'LOG IN' : 'SIGN UP'}
          </Text>
        )}
      </Pressable>

      <Text style={styles.note}>
        {isSupabaseConfigured
          ? 'Your pets sync across devices — log in anywhere.'
          : 'Accounts are stored on this device only.'}
      </Text>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    width: 280,
    height: 60,
    marginBottom: 8,
  },
  subtitle: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    marginBottom: 20,
  },
  tabs: {
    flexDirection: 'row',
    width: '80%',
    maxWidth: 320,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2a1a4a',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#7a4ed0',
  },
  tabText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  tabTextActive: {
    color: '#fff',
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
    marginBottom: 10,
    textAlign: 'center',
  },
  error: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 6,
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 30,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#e23a5a',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  note: {
    marginTop: 24,
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    textAlign: 'center',
  },
});

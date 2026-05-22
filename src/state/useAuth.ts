import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const USERS_KEY = '@pixelpets/users/v1';
const SESSION_KEY = '@pixelpets/session/v1';

type UserRecord = {
  hash: string;
  salt: string;
  createdAt: number;
};

type UserMap = Record<string, UserRecord>;

export type AuthResult = { ok: true } | { ok: false; error: string };

const normalize = (u: string) => u.trim().toLowerCase();

const randomSalt = async () => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const hashPassword = async (password: string, salt: string) =>
  Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );

const loadUsers = async (): Promise<UserMap> => {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as UserMap) : {};
  } catch {
    return {};
  }
};

const saveUsers = (users: UserMap) =>
  AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

export const useAuth = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { username: string };
          if (parsed?.username) setUsername(parsed.username);
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const signUp = useCallback(
    async (rawName: string, password: string): Promise<AuthResult> => {
      const name = normalize(rawName);
      if (name.length < 2) return { ok: false, error: 'Username too short' };
      if (name.length > 20) return { ok: false, error: 'Username too long' };
      if (!/^[a-z0-9_.-]+$/i.test(name))
        return { ok: false, error: 'Letters, numbers, . _ - only' };
      if (password.length < 4)
        return { ok: false, error: 'Password must be 4+ characters' };
      const users = await loadUsers();
      if (users[name]) return { ok: false, error: 'Username already taken' };
      const salt = await randomSalt();
      const hash = await hashPassword(password, salt);
      users[name] = { salt, hash, createdAt: Date.now() };
      await saveUsers(users);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ username: name }));
      setUsername(name);
      return { ok: true };
    },
    []
  );

  const logIn = useCallback(
    async (rawName: string, password: string): Promise<AuthResult> => {
      const name = normalize(rawName);
      if (!name || !password)
        return { ok: false, error: 'Enter username and password' };
      const users = await loadUsers();
      const record = users[name];
      if (!record) return { ok: false, error: 'No account with that name' };
      const hash = await hashPassword(password, record.salt);
      if (hash !== record.hash) return { ok: false, error: 'Wrong password' };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ username: name }));
      setUsername(name);
      return { ok: true };
    },
    []
  );

  const logOut = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUsername(null);
  }, []);

  return { username, loaded, signUp, logIn, logOut };
};

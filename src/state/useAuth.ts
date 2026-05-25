import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, usernameToEmail } from '../lib/supabase';

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

// Shared username/password validation. Supabase requires 6+ char passwords;
// the local fallback historically allowed 4+, so we pass the min in.
const validate = (name: string, password: string, minPass: number): string | null => {
  if (name.length < 2) return 'Username too short';
  if (name.length > 20) return 'Username too long';
  if (!/^[a-z0-9_.-]+$/i.test(name)) return 'Letters, numbers, . _ - only';
  if (password.length < minPass) return `Password must be ${minPass}+ characters`;
  return null;
};

// ── Local (fallback) auth helpers ─────────────────────────────────────────────
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

const usernameFromSession = (session: Session | null): string | null => {
  if (!session?.user) return null;
  const meta = session.user.user_metadata as { username?: string } | undefined;
  if (meta?.username) return meta.username;
  const email = session.user.email ?? '';
  return email.includes('@') ? email.split('@')[0] : null;
};

export const useAuth = () => {
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setUsername(usernameFromSession(data.session));
        setLoaded(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        setUsername(usernameFromSession(session));
      });
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }
    // Local fallback session restore
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as { username: string };
          if (parsed?.username) setUsername(parsed.username);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signUp = useCallback(
    async (rawName: string, password: string): Promise<AuthResult> => {
      const name = normalize(rawName);

      if (isSupabaseConfigured && supabase) {
        const err = validate(name, password, 6);
        if (err) return { ok: false, error: err };
        const { data, error } = await supabase.auth.signUp({
          email: usernameToEmail(name),
          password,
          options: { data: { username: name } },
        });
        if (error) {
          if (/already/i.test(error.message))
            return { ok: false, error: 'Username already taken' };
          return { ok: false, error: error.message };
        }
        // With email confirmation off, a session is returned immediately.
        if (data.session) setUsername(name);
        else {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: usernameToEmail(name),
            password,
          });
          if (signInErr) return { ok: false, error: signInErr.message };
        }
        return { ok: true };
      }

      // Local fallback
      const err = validate(name, password, 4);
      if (err) return { ok: false, error: err };
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

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(name),
          password,
        });
        if (error) return { ok: false, error: 'Wrong username or password' };
        return { ok: true };
      }

      // Local fallback
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
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      setUsername(null);
      return;
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    setUsername(null);
  }, []);

  return { username, loaded, signUp, logIn, logOut };
};

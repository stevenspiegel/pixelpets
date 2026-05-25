import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Injected at build time (Expo exposes EXPO_PUBLIC_* to the client).
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Usernames are mapped to a synthetic email for Supabase Auth (which is
// email-based). No real mail is ever sent — email confirmation must be
// turned OFF in the Supabase dashboard for this to work.
export const SYNTHETIC_EMAIL_DOMAIN = 'pixelpetsworld.com';
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;

export const isSupabaseConfigured = Boolean(url && anonKey);

// When env vars are absent (e.g. local dev before secrets are wired), this is
// null and the app falls back to local-only auth/storage.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

import { ImageSourcePropType } from 'react-native';
import { supabase } from '../lib/supabase';

// Cosmetic background scenes shown behind the pet on the home screen, unlocked
// with earned Pixel Tokens. The display catalog lives here; prices are validated
// server-side in unlock_background (keep the price in sync with
// _background_price in supabase/schema.sql).
export type BackgroundDef = {
  id: string;
  name: string;
  price: number; // 0 = free / always owned
};

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'default', name: 'Classic', price: 0 },
  { id: 'beach', name: 'Beach', price: 400 },
  { id: 'mountains', name: 'Mountains', price: 400 },
  { id: 'tropical', name: 'Tropical', price: 400 },
];

// id → bundled image. 'default' has no image (the flat panel colour shows).
export const BACKGROUND_IMAGES: Record<string, ImageSourcePropType> = {
  beach: require('../../assets/backgrounds/beach.png'),
  mountains: require('../../assets/backgrounds/mountains.png'),
  tropical: require('../../assets/backgrounds/tropical.png'),
};

export const backgroundImage = (id: string): ImageSourcePropType | undefined =>
  BACKGROUND_IMAGES[id];

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

// Read the player's owned backgrounds + equipped one. Defaults to owning only
// 'default' in local-only mode or on error.
export const fetchBackgrounds = async (): Promise<{ owned: string[]; active: string }> => {
  const fallback = { owned: ['default'], active: 'default' };
  if (!supabase) return fallback;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return fallback;
  const { data, error } = await supabase
    .from('profiles')
    .select('backgrounds, active_background')
    .eq('id', uid)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[pixelpets] load backgrounds error:', error.message);
    return fallback;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    owned: (d.backgrounds as string[]) ?? ['default'],
    active: (d.active_background as string) ?? 'default',
  };
};

// Unlock a background (server charges tokens atomically). Returns the new
// balance + owned list on success.
export const unlockBackground = async (
  id: string
): Promise<Result<{ tokens: number; owned: string[] }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('unlock_background', { p_id: id });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = data as any;
  return {
    ok: true,
    value: { tokens: Number(res.tokens), owned: (res.backgrounds as string[]) ?? [] },
  };
};

// Equip an owned background.
export const setActiveBackground = async (id: string): Promise<Result<null>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('set_active_background', { p_id: id });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true, value: null };
};

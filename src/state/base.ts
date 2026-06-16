import { supabase } from '../lib/supabase';

// Base / Habitat: a per-account home scene decorated with token-bought items
// placed on a grid, resolved/validated server-side (unlock_decor /
// save_base_layout). The catalog here is the display source of truth; prices +
// the valid-id set are mirrored in supabase/schema.sql (_decor_price) and the
// grid size in _base_grid.
export const BASE_GRID = 6; // 6x6
export const BASE_MAX_ITEMS = 40;

export type DecorDef = {
  id: string;
  name: string;
  price: number;
  // Footprint in grid cells (default 1x1). Kept small in Phase 1.
  w?: number;
  h?: number;
  // A simple stub glyph used until real decoration art is dropped in.
  glyph: string;
};

// Decorations placeable on the grid.
export const BASE_DECOR: DecorDef[] = [
  { id: 'fence', name: 'Fence', price: 20, glyph: '🪵' },
  { id: 'rock', name: 'Rock', price: 25, glyph: '🪨' },
  { id: 'bush', name: 'Bush', price: 30, glyph: '🌿' },
  { id: 'bowl', name: 'Food Bowl', price: 40, glyph: '🥣' },
  { id: 'ball', name: 'Toy Ball', price: 40, glyph: '⚽' },
  { id: 'flowers', name: 'Flowers', price: 50, glyph: '🌷' },
  { id: 'tree', name: 'Tree', price: 60, glyph: '🌳' },
  { id: 'lamp', name: 'Lamp', price: 70, glyph: '🏮' },
  { id: 'bed', name: 'Pet Bed', price: 80, glyph: '🛏️' },
  { id: 'pond', name: 'Pond', price: 120, glyph: '⛲' },
];

// Unlockable floor themes (id prefixed floor_). 'grass' is the free default.
export type FloorDef = { id: string; name: string; price: number; color: string };
export const BASE_FLOORS: FloorDef[] = [
  { id: 'grass', name: 'Grass', price: 0, color: '#2e7d4f' },
  { id: 'floor_sand', name: 'Sand', price: 200, color: '#d9b771' },
  { id: 'floor_snow', name: 'Snow', price: 200, color: '#cfe3ef' },
];

export const decorById = (id: string): DecorDef | undefined =>
  BASE_DECOR.find((d) => d.id === id);
export const floorColor = (id: string): string =>
  BASE_FLOORS.find((f) => f.id === id)?.color ?? '#2e7d4f';

// Care stats a functional decoration can slow the decay of. Mirrors
// _decor_functional_stat in supabase/schema.sql.
export type CareStat = 'hunger' | 'happiness' | 'cleanliness' | 'energy';

// Functional decorations: id → the stat it slows while placed + fueled.
// Mirrors _decor_functional_stat in supabase/schema.sql (server is source of truth).
export const FUNCTIONAL_DECOR: Record<string, CareStat> = {
  bowl: 'hunger',
  ball: 'happiness',
  bed: 'energy',
  pond: 'cleanliness',
};

// Balance constants — mirror _decor_fuel_ms / _decor_refill_cost / _decor_decay_mult.
export const FUEL_FILL_MS = 48 * 3600 * 1000; // a full reservoir = 48h
export const REFILL_COST = 15;                // tokens to refill to full
export const DECAY_MULT = 0.6;                // fueled item → 40% slower decay

export const functionalStat = (id: string): CareStat | undefined =>
  FUNCTIONAL_DECOR[id];

export type Placed = { id: string; x: number; y: number };
export type PlacedPet = { petId: string; x: number; y: number };

export type BaseState = {
  owned: string[];
  layout: Placed[];
  pets: PlacedPet[];
  floor: string;
  fuel: Record<string, number>; // decor id → filled_until (epoch ms)
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

export const fetchBase = async (): Promise<BaseState> => {
  const fallback: BaseState = { owned: [], layout: [], pets: [], floor: 'grass', fuel: {} };
  if (!supabase) return fallback;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return fallback;
  const { data, error } = await supabase
    .from('profiles')
    .select('base_decor_owned, base_layout, base_pets, base_floor, base_fuel')
    .eq('id', uid)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[pixelpets] load base error:', error.message);
    return fallback;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    owned: (d.base_decor_owned as string[]) ?? [],
    layout: (d.base_layout as Placed[]) ?? [],
    pets: (d.base_pets as PlacedPet[]) ?? [],
    floor: (d.base_floor as string) ?? 'grass',
    fuel: (d.base_fuel as Record<string, number>) ?? {},
  };
};

// Unlock a decoration or floor; server charges tokens atomically.
export const unlockDecor = async (
  id: string
): Promise<Result<{ tokens: number; owned: string[] }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('unlock_decor', { p_id: id });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: { tokens: Number(d.tokens), owned: (d.owned as string[]) ?? [] } };
};

// Refill a functional decoration's fuel to full; server charges REFILL_COST.
export const refillDecor = async (
  id: string
): Promise<Result<{ tokens: number; fuel: Record<string, number> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('refill_decor', { p_id: id });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ok: true,
    value: { tokens: Number(d.tokens), fuel: (d.base_fuel as Record<string, number>) ?? {} },
  };
};

// Persist the placed decor + floor + pet positions (server validates
// ownership/bounds/count and that each placed pet belongs to the caller).
export const saveBaseLayout = async (
  layout: Placed[],
  floor: string,
  pets: PlacedPet[]
): Promise<Result<null>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('save_base_layout', {
    p_layout: layout,
    p_floor: floor,
    p_pets: pets,
  });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true, value: null };
};

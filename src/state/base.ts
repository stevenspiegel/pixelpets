import { supabase } from '../lib/supabase';

// Base / Habitat: a per-account home scene decorated with token-bought items
// placed on a grid, resolved/validated server-side (unlock_decor /
// save_base_layout). The catalog here is the display source of truth; prices +
// the valid-id set are mirrored in supabase/schema.sql (_decor_price) and the
// grid size in _base_grid.
export const BASE_GRID = 12; // 12x12 (shown through a pan/zoom viewport)
export const BASE_MAX_ITEMS = 120; // anti-abuse cap, generous on the 144-cell board

export type DecorDef = {
  id: string;
  name: string;
  price: number;
  // Footprint in grid cells (default 1x1). Kept small in Phase 1.
  w?: number;
  h?: number;
  // A simple stub glyph used until real decoration art is dropped in.
  glyph: string;
  // Render the art edge-to-edge (full cell) instead of inset, so copies in
  // adjacent cells touch. Used by the fence pieces, whose art tiles seamlessly.
  tile?: boolean;
};

// Decorations placeable on the grid.
export const BASE_DECOR: DecorDef[] = [
  { id: 'fence', name: 'Fence ↔', price: 20, glyph: '🪵', tile: true },
  { id: 'fence_v', name: 'Fence ↕', price: 20, glyph: '🪵', tile: true },
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

// ── Phase 2: token buildings ────────────────────────────────────────────────
// One-of-each, upgradeable structures placed on the grid that passively accrue
// over time, collected on a tap. Display catalog only — prices/rates/caps are
// re-validated server-side (_building_* in supabase/schema.sql is source of truth).
export type BuildingId = 'mine' | 'incubator' | 'feeder' | 'vault';

export const EGG_SHARDS_PER_EGG = 150; // mirrors hatch_pet shard cost

export type BuildingDef = {
  id: BuildingId;
  name: string;
  glyph: string;                 // temporary placeholder until art is wired
  buildCost: number;
  maxLevel: number;
  kind: 'accrual' | 'cooldown';
  unit: 'tokens' | 'shards' | 'care';
  ready: string;                 // emoji shown on the readiness badge
  ratePerHour: (level: number) => number; // accrual buildings (display)
  cap: (level: number) => number;         // accrual reservoir cap
  cooldownMs: (level: number) => number;  // cooldown buildings
  upgradeCost: (level: number) => number | null; // null = maxed
};

const HOUR = 3600 * 1000;
const upCost = (level: number): number | null =>
  level === 1 ? 80 : level === 2 ? 160 : null;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'mine', name: 'Token Mine', glyph: '⛏️', buildCost: 150, maxLevel: 3,
    kind: 'accrual', unit: 'tokens', ready: '💰',
    ratePerHour: (l) => [0, 1, 1.5, 2][l] ?? 0,
    cap: (l) => [0, 12, 20, 30][l] ?? 0,
    cooldownMs: () => 0, upgradeCost: upCost,
  },
  {
    id: 'incubator', name: 'Egg Incubator', glyph: '🥚', buildCost: 200, maxLevel: 3,
    kind: 'accrual', unit: 'shards', ready: '🥚',
    ratePerHour: (l) => [0, 1, 1.5, 2][l] ?? 0,
    cap: (l) => [0, 12, 20, 30][l] ?? 0,
    cooldownMs: () => 0, upgradeCost: upCost,
  },
  {
    id: 'feeder', name: 'Care Feeder', glyph: '🍼', buildCost: 120, maxLevel: 3,
    kind: 'cooldown', unit: 'care', ready: '❤️',
    ratePerHour: () => 0, cap: () => 0,
    cooldownMs: (l) => ([0, 12, 8, 6][l] ?? 0) * HOUR,
    upgradeCost: upCost,
  },
  {
    id: 'vault', name: 'Treasure Vault', glyph: '🎁', buildCost: 250, maxLevel: 3,
    kind: 'cooldown', unit: 'tokens', ready: '🎁',
    ratePerHour: () => 0, cap: () => 0,
    cooldownMs: (l) => ([0, 24, 20, 16][l] ?? 0) * HOUR,
    upgradeCost: upCost,
  },
];

export const buildingById = (id: string): BuildingDef | undefined =>
  BUILDINGS.find((b) => b.id === id);

// How much an accrual building has produced since last collect (client estimate
// for the readiness badge; the server re-computes authoritatively on collect).
export const accrued = (def: BuildingDef, st: BuildingState, now: number): number =>
  Math.min(def.cap(st.level), Math.floor(((now - st.collectedAt) / HOUR) * def.ratePerHour(st.level)));

// Whether a building is collectible right now (badge logic).
export const isReady = (def: BuildingDef, st: BuildingState, now: number): boolean =>
  def.kind === 'accrual'
    ? accrued(def, st, now) >= 1
    : now - st.collectedAt >= def.cooldownMs(st.level);

export type BuildingState = { level: number; x: number; y: number; collectedAt: number };

export type Placed = { id: string; x: number; y: number };
export type PlacedPet = { petId: string; x: number; y: number };

export type BaseState = {
  owned: string[];
  layout: Placed[];
  pets: PlacedPet[];
  floor: string;
  fuel: Record<string, number>; // decor id → filled_until (epoch ms)
  buildings: Record<string, BuildingState>;
  eggShards: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

// The server stores building state with snake_case keys ({ level, x, y,
// collected_at } — see supabase/schema.sql), but BuildingState uses collectedAt.
// Without this remap st.collectedAt is undefined, so accrued()/isReady() compute
// NaN and the readiness badge never shows. Normalize at every read boundary.
const normalizeBuildings = (raw: unknown): Record<string, BuildingState> => {
  const out: Record<string, BuildingState> = {};
  for (const [id, b] of Object.entries((raw as Record<string, any>) ?? {})) {
    out[id] = {
      level: Number(b.level),
      x: Number(b.x),
      y: Number(b.y),
      collectedAt: Number(b.collected_at ?? b.collectedAt ?? 0),
    };
  }
  return out;
};

export const fetchBase = async (): Promise<BaseState> => {
  const fallback: BaseState = { owned: [], layout: [], pets: [], floor: 'grass', fuel: {}, buildings: {}, eggShards: 0 };
  if (!supabase) return fallback;
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return fallback;
  const { data, error } = await supabase
    .from('profiles')
    .select('base_decor_owned, base_layout, base_pets, base_floor, base_fuel, base_buildings, egg_shards')
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
    buildings: normalizeBuildings(d.base_buildings),
    eggShards: Number(d.egg_shards ?? 0),
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

// Build / upgrade / collect a structure. Server charges + computes yield; the
// client only triggers and reads back the new wallet + buildings map.
export const buildStructure = async (
  type: BuildingId, x: number, y: number
): Promise<Result<{ tokens: number; buildings: Record<string, BuildingState> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('build_structure', { p_type: type, p_x: x, p_y: y });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: { tokens: Number(d.tokens), buildings: normalizeBuildings(d.base_buildings) } };
};

export const upgradeStructure = async (
  type: BuildingId
): Promise<Result<{ tokens: number; eggShards: number; buildings: Record<string, BuildingState> }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('upgrade_structure', { p_type: type });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: { tokens: Number(d.tokens), eggShards: Number(d.egg_shards), buildings: normalizeBuildings(d.base_buildings) } };
};

export const collectStructure = async (
  type: BuildingId
): Promise<Result<{ tokens: number; eggShards: number; buildings: Record<string, BuildingState>; yield: number }>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('collect_structure', { p_type: type });
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ok: true, value: {
    tokens: Number(d.tokens), eggShards: Number(d.egg_shards),
    buildings: normalizeBuildings(d.base_buildings), yield: Number(d.yield ?? 0),
  } };
};

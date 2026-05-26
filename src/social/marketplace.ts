import { PetState, Rarity, BattleStats, LifeStage } from '../types';
import { supabase } from '../lib/supabase';

export type Listing = {
  petId: string;
  sellerUsername: string;
  price: number;
  name: string;
  species: string;
  rarity: Rarity;
  level: number;
  stage: LifeStage;
  ascended: boolean;
  stats: BattleStats;
};

export type Result = { ok: true } | { ok: false; error: string };

// Supabase surfaces RPC errors like "...: Not enough tokens"; strip the prefix.
const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

export const listAdoptions = async (): Promise<Listing[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_adoptions');
  if (error) {
    console.warn('[pixelpets] list adoptions error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    petId: r.pet_id,
    sellerUsername: r.seller_username,
    price: Number(r.price) || 0,
    name: r.name,
    species: r.species,
    rarity: r.rarity as Rarity,
    level: Number(r.level) || 1,
    stage: r.stage as LifeStage,
    ascended: !!r.ascended,
    stats: r.stats as BattleStats,
  }));
};

export const listPetForAdoption = async (
  petId: string,
  price: number
): Promise<Result> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('list_pet_for_adoption', {
    target_pet: petId,
    price,
  });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true };
};

export const cancelListing = async (petId: string): Promise<Result> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('cancel_listing', { target_pet: petId });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true };
};

export const adoptPet = async (petId: string): Promise<Result> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('adopt_pet', { target_pet: petId });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true };
};

// Synthesize a PetState from a listing so display helpers (battleStats, sprites)
// can be reused, mirroring friendPetToPet.
export const listingToPet = (l: Listing): PetState => ({
  id: l.petId,
  name: l.name,
  species: l.species,
  rarity: l.rarity,
  stats: l.stats,
  level: l.level,
  stage: l.stage,
  ascended: l.ascended,
  hunger: 100,
  happiness: 100,
  cleanliness: 100,
  energy: 100,
  health: 100,
  age: 0,
  bornAt: 0,
  lastTick: 0,
  asleep: false,
  poops: 0,
  sick: false,
});

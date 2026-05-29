import { PetState, Rarity, BattleStats, LifeStage } from '../types';
import { supabase } from '../lib/supabase';

export type Friend = {
  username: string;
  wins: number;
  losses: number;
  petCount: number;
};

export type FriendPet = {
  id: string;
  name: string;
  species: string;
  rarity: Rarity;
  stats: BattleStats;
  level: number;
  stage: LifeStage;
  ascended: boolean;
};

export type Result = { ok: true } | { ok: false; error: string };

// Supabase surfaces RPC errors like "...: No player named X"; strip the prefix.
const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

export type SendResult =
  | { ok: true; status: 'requested' | 'accepted' }
  | { ok: false; error: string };

// Send a friend request. If the target already requested you, it's accepted
// immediately (status 'accepted'); otherwise a pending request is created.
export const sendFriendRequest = async (username: string): Promise<SendResult> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const name = username.trim();
  if (!name) return { ok: false, error: 'Enter a username' };
  const { data, error } = await supabase.rpc('send_friend_request', { target: name });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true, status: data === 'accepted' ? 'accepted' : 'requested' };
};

export const listFriendRequests = async (): Promise<string[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_friend_requests');
  if (error) {
    console.warn('[pixelpets] list requests error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.username as string);
};

export const respondFriendRequest = async (
  fromUsername: string,
  accept: boolean
): Promise<Result> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('respond_friend_request', {
    from_user: fromUsername,
    accept,
  });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true };
};

export const removeFriend = async (username: string): Promise<Result> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { error } = await supabase.rpc('remove_friend', { target: username });
  if (error) return { ok: false, error: cleanError(error.message) };
  return { ok: true };
};

export const listFriends = async (): Promise<Friend[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_friends');
  if (error) {
    console.warn('[pixelpets] list friends error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    username: r.username,
    wins: Number(r.pvp_wins) || 0,
    losses: Number(r.pvp_losses) || 0,
    petCount: Number(r.pet_count) || 0,
  }));
};

export const getFriendPets = async (username: string): Promise<FriendPet[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_friend_pets', { target: username });
  if (error) {
    console.warn('[pixelpets] friend pets error:', error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.pet_id,
    name: r.name,
    species: r.species,
    rarity: r.rarity as Rarity,
    stats: r.stats as BattleStats,
    level: Number(r.level) || 1,
    stage: r.stage as LifeStage,
    ascended: !!r.ascended,
  }));
};

// Synthesize a PetState from a friend's pet so display helpers (battleStats,
// sprites) can be reused.
export const friendPetToPet = (fp: FriendPet): PetState => ({
  id: fp.id,
  name: fp.name,
  species: fp.species,
  rarity: fp.rarity,
  stats: fp.stats,
  level: fp.level,
  stage: fp.stage,
  ascended: fp.ascended,
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

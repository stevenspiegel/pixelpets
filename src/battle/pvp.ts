import { PetState } from '../types';
import { supabase } from '../lib/supabase';
import { Combatant } from './engine';
import { playerCombatant } from './opponent';
import { speciesName } from '../state/usePet';

// Build a battle Combatant from a random opponent row returned by the
// get_random_opponent RPC, reusing the same effective-stat scaling as the
// player (via a synthesized PetState).
const opponentFromRow = (row: any): Combatant => {
  const pet: PetState = {
    id: row.pet_id,
    name: row.name,
    species: row.species,
    rarity: row.rarity,
    stats: row.stats,
    level: Number(row.level) || 1,
    stage: row.stage,
    ascended: !!row.ascended,
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
  };
  const c = playerCombatant(pet);
  const owner = row.owner_username ? `@${row.owner_username}` : 'a rival';
  return { ...c, name: `${row.name} (${owner})` };
};

// Fetch a random opponent pet belonging to another player. Returns null if
// no opponent is available (e.g. you're the only player) or on error.
export const fetchPvpOpponent = async (): Promise<Combatant | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_random_opponent');
  if (error) {
    console.warn('[pixelpets] pvp opponent error:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return opponentFromRow(row);
};

export const recordPvpResult = async (won: boolean): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_pvp_result', { won });
  if (error) console.warn('[pixelpets] record pvp result error:', error.message);
};

export type LeaderRow = { username: string; wins: number; losses: number };

export const fetchLeaderboard = async (): Promise<LeaderRow[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('pvp_leaderboard');
  if (error) {
    console.warn('[pixelpets] leaderboard error:', error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    username: r.username,
    wins: Number(r.pvp_wins) || 0,
    losses: Number(r.pvp_losses) || 0,
  }));
};

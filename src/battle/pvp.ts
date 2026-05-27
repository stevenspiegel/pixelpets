import { PetState, Rarity, LifeStage } from '../types';
import { supabase } from '../lib/supabase';
import { Combatant } from './engine';
import { playerCombatant } from './opponent';
import { speciesName } from '../state/usePet';
import { Tactic } from './tactics';

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

// ── Turn-based server-resolved battles ────────────────────────────────────────
// The server owns all battle state: start_battle creates a hidden battle row
// with both sides' authoritative stats, and each battle_turn applies one round
// of stat-scaled, tactic-modified damage. Wins, rewards, and PvP records are
// only ever written by the server, so nothing here can be forged by the client.

// A combatant as the server reports it (display + current HP).
export type BattleCombatant = {
  name: string;
  species: string;
  stage: LifeStage;
  rarity: Rarity;
  ascended: boolean;
  level: number;
  attack: number;
  defense: number;
  speed: number;
  maxHp: number;
  hp: number;
};

export type BattleStart =
  | { empty: true }
  | { error: string }
  | {
      battleId: string;
      turn: number;
      status: 'active';
      player: BattleCombatant;
      enemy: BattleCombatant;
    };

export type TurnResult = {
  status: 'active' | 'won' | 'lost';
  turn: number;
  tactic: Tactic;
  enemyTactic: Tactic;
  order: 'player' | 'enemy'; // who struck first this turn (by speed)
  playerHp: number;
  enemyHp: number;
  playerDmg: number; // damage the player dealt this turn (0 if KO'd first)
  enemyDmg: number; // damage the enemy dealt this turn
  reward: number; // tokens awarded (only when status === 'won')
  tokens: number; // caller's new balance (only when battle ended)
};

// Begin a battle: the server builds the opponent and stores the fight.
export const startBattle = async (
  mode: 'pve' | 'pvp',
  petId: string
): Promise<BattleStart | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('start_battle', {
    p_mode: mode,
    p_pet_id: petId,
  });
  if (error) {
    // Surface the reason (e.g. an egg can't battle) instead of masking it as
    // "no opponents" — the caller decides how to present it.
    console.warn('[pixelpets] start battle error:', error.message);
    return { error: error.message };
  }
  const res = data as BattleStart;
  // PvE enemy names arrive packed as "Adjective|species"; turn the species
  // emoji into its display name client-side (speciesName lives here).
  if (res && 'battleId' in res && res.enemy.name.includes('|')) {
    const [adj, sp] = res.enemy.name.split('|');
    res.enemy.name = `${adj} ${speciesName(sp)}`;
  }
  return res;
};

// Play one turn with the chosen tactic; the server resolves the round.
export const battleTurn = async (
  battleId: string,
  tactic: Tactic
): Promise<TurnResult | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('battle_turn', {
    p_battle_id: battleId,
    p_tactic: tactic,
  });
  if (error) {
    console.warn('[pixelpets] battle turn error:', error.message);
    return null;
  }
  return data as TurnResult;
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

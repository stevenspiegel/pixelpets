import { supabase } from '../lib/supabase';

// 3-reel slot machine. The spin is resolved server-side (slot_spin RPC): the bet
// is deducted, reels rolled, and any payout credited atomically — the client just
// animates the result. Symbols are indexed 0-4.
//
// The reels use the game's OWN pet sprites (via CreatureSprite), not emoji — one
// species per rarity tier, ascending with the payout (index 0 = lowest pay,
// index 4 = jackpot). Each entry is { species, stage } for CreatureSprite.
export const SLOT_SYMBOLS: { species: string; stage: 'adult' }[] = [
  { species: '🐕', stage: 'adult' }, // common  — Dog
  { species: '🦊', stage: 'adult' }, // uncommon — Fox
  { species: '🦉', stage: 'adult' }, // rare    — Owl
  { species: '🦈', stage: 'adult' }, // epic    — Shark
  { species: '🐉', stage: 'adult' }, // legendary — Dragon (jackpot)
];
export const SLOT_BET = 10;

export type SpinResult = {
  reels: [number, number, number];
  payout: number;
  bet: number;
  tokens: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const cleanError = (msg: string): string =>
  msg.includes(':') ? msg.slice(msg.lastIndexOf(':') + 1).trim() : msg;

export const spinSlots = async (): Promise<Result<SpinResult>> => {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('slot_spin');
  if (error) return { ok: false, error: cleanError(error.message) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    ok: true,
    value: {
      reels: d.reels as [number, number, number],
      payout: Number(d.payout),
      bet: Number(d.bet),
      tokens: Number(d.tokens),
    },
  };
};

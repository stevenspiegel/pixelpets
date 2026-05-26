// Per-turn tactic choice — a rock-paper-scissors triangle the player picks each
// turn of a (server-resolved) battle. Winning the matchup boosts the player's
// outgoing damage that turn and blunts the enemy's. The same triangle is
// mirrored in the battle_turn SQL function; keep them in sync.
//   aggressive ▶ balanced ▶ defensive ▶ aggressive
export type Tactic = 'aggressive' | 'balanced' | 'defensive';

export const TACTIC_ORDER: Tactic[] = ['aggressive', 'balanced', 'defensive'];

export const TACTICS: Record<
  Tactic,
  { label: string; icon: string; beats: Tactic; hint: string }
> = {
  aggressive: { label: 'Aggressive', icon: '⚔️', beats: 'balanced', hint: 'beats Balanced' },
  balanced: { label: 'Balanced', icon: '⚖️', beats: 'defensive', hint: 'beats Defensive' },
  defensive: { label: 'Defensive', icon: '🛡️', beats: 'aggressive', hint: 'beats Aggressive' },
};

export type Matchup = 'advantage' | 'disadvantage' | 'even';

export const tacticMatchup = (player: Tactic, enemy: Tactic): Matchup =>
  player === enemy
    ? 'even'
    : TACTICS[player].beats === enemy
      ? 'advantage'
      : 'disadvantage';

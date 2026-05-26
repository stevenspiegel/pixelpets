// Pre-battle tactic choice — a rock-paper-scissors triangle the player commits
// to before the (server-resolved) fight. The same triangle is mirrored in the
// resolve_battle SQL function; keep them in sync.
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

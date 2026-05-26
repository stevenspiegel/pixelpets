// Per-turn tactic choice. Two strategic layers, both mirrored in the
// battle_turn SQL function — keep them in sync:
//   1. Inherent stance: Aggressive deals & takes more, Defensive deals & takes
//      less, Balanced is neutral. This applies every turn regardless of the foe.
//   2. RPS matchup: aggressive ▶ balanced ▶ defensive ▶ aggressive. Winning the
//      matchup boosts your outgoing damage that turn and blunts the foe's.
export type Tactic = 'aggressive' | 'balanced' | 'defensive';

export const TACTIC_ORDER: Tactic[] = ['aggressive', 'balanced', 'defensive'];

export const TACTICS: Record<
  Tactic,
  { label: string; icon: string; beats: Tactic; hint: string; stance: string }
> = {
  aggressive: { label: 'Aggressive', icon: '⚔️', beats: 'balanced', hint: 'beats Balanced', stance: '+30% deal & take' },
  balanced: { label: 'Balanced', icon: '⚖️', beats: 'defensive', hint: 'beats Defensive', stance: 'no modifier' },
  defensive: { label: 'Defensive', icon: '🛡️', beats: 'aggressive', hint: 'beats Aggressive', stance: '−30% deal & take' },
};

export type Matchup = 'advantage' | 'disadvantage' | 'even';

export const tacticMatchup = (player: Tactic, enemy: Tactic): Matchup =>
  player === enemy
    ? 'even'
    : TACTICS[player].beats === enemy
      ? 'advantage'
      : 'disadvantage';

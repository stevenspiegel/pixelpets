// Per-turn tactic choice. Two strategic layers, both mirrored in the
// battle_turn SQL function — keep them in sync:
//   1. Inherent stance: Aggressive deals +25% but takes +40% (a gamble);
//      Defensive deals -20% but takes -10%; Balanced is neutral. Applies every
//      turn regardless of the foe. Multipliers are balance-tuned so no stance
//      dominates — the choice is about game state (push vs. survive).
//   2. RPS matchup: aggressive ▶ balanced ▶ defensive ▶ aggressive. Winning the
//      matchup boosts your outgoing damage that turn and blunts the foe's.
export type Tactic = 'aggressive' | 'balanced' | 'defensive';

export const TACTIC_ORDER: Tactic[] = ['aggressive', 'balanced', 'defensive'];

export const TACTICS: Record<
  Tactic,
  { label: string; icon: string; beats: Tactic; hint: string; stance: string }
> = {
  aggressive: { label: 'Aggressive', icon: '⚔️', beats: 'balanced', hint: 'beats Balanced', stance: 'hit harder, take more' },
  balanced: { label: 'Balanced', icon: '⚖️', beats: 'defensive', hint: 'beats Defensive', stance: 'no modifier' },
  defensive: { label: 'Defensive', icon: '🛡️', beats: 'aggressive', hint: 'beats Aggressive', stance: 'guard up, hit softer' },
};

export type Matchup = 'advantage' | 'disadvantage' | 'even';

export const tacticMatchup = (player: Tactic, enemy: Tactic): Matchup =>
  player === enemy
    ? 'even'
    : TACTICS[player].beats === enemy
      ? 'advantage'
      : 'disadvantage';

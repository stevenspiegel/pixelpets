import { LifeStage, Rarity } from '../types';

export type Move = 'attack' | 'power' | 'guard';

export type Combatant = {
  name: string;
  species: string;
  stage: LifeStage;
  rarity: Rarity;
  ascended?: boolean;
  level: number;
  attack: number;
  defense: number;
  speed: number;
  maxHp: number;
  hp: number;
  guarding: boolean;
};

export type BattleState = {
  player: Combatant;
  enemy: Combatant;
  log: string[];
  round: number;
  status: 'active' | 'won' | 'lost';
};

export const MOVES: Record<Move, { label: string; icon: string; power: number }> = {
  attack: { label: 'Attack', icon: '⚔️', power: 1.0 },
  power: { label: 'Power', icon: '💥', power: 1.7 },
  guard: { label: 'Guard', icon: '🛡️', power: 0 },
};

const damage = (
  atkStat: number,
  defStat: number,
  power: number,
  defenderGuarding: boolean
): { dmg: number; crit: boolean } => {
  if (power === 0) return { dmg: 0, crit: false };
  const variance = 0.85 + Math.random() * 0.3; // 0.85–1.15
  const crit = Math.random() < 0.12;
  let dmg = (atkStat * power - defStat * 0.5) * variance;
  if (crit) dmg *= 1.5;
  if (defenderGuarding) dmg *= 0.45;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
};

// Simple opponent AI: mostly attacks, occasionally guards (more when hurt),
// sometimes uses a power hit.
export const chooseAiMove = (self: Combatant): Move => {
  const hurt = self.hp / self.maxHp < 0.35;
  const r = Math.random();
  if (hurt && r < 0.3) return 'guard';
  if (r < 0.25) return 'power';
  if (r < 0.33) return 'guard';
  return 'attack';
};

const applyMove = (
  attacker: Combatant,
  defender: Combatant,
  move: Move,
  log: string[]
): void => {
  if (move === 'guard') {
    attacker.guarding = true;
    log.push(`${attacker.name} braces for impact. 🛡️`);
    return;
  }
  const { dmg, crit } = damage(
    attacker.attack,
    defender.defense,
    MOVES[move].power,
    defender.guarding
  );
  defender.hp = Math.max(0, defender.hp - dmg);
  const verb = move === 'power' ? 'unleashes a Power hit on' : 'attacks';
  log.push(
    `${attacker.name} ${verb} ${defender.name} for ${dmg}${crit ? ' (CRIT!)' : ''} 💢`
  );
};

// Resolve one full round: both pick a move, faster combatant acts first.
export const resolveRound = (
  state: BattleState,
  playerMove: Move
): BattleState => {
  if (state.status !== 'active') return state;

  const player: Combatant = { ...state.player, guarding: false };
  const enemy: Combatant = { ...state.enemy, guarding: false };
  const enemyMove = chooseAiMove(enemy);
  const log: string[] = [];

  // Guards must be set before damage so they reduce this round's hits.
  if (playerMove === 'guard') player.guarding = true;
  if (enemyMove === 'guard') enemy.guarding = true;

  const playerFirst =
    player.speed > enemy.speed ||
    (player.speed === enemy.speed && Math.random() < 0.5);

  const order: [Combatant, Combatant, Move][] = playerFirst
    ? [
        [player, enemy, playerMove],
        [enemy, player, enemyMove],
      ]
    : [
        [enemy, player, enemyMove],
        [player, enemy, playerMove],
      ];

  for (const [attacker, defender, move] of order) {
    if (player.hp <= 0 || enemy.hp <= 0) break;
    // Guard already recorded above; applyMove for a guard just logs the brace.
    if (move === 'guard') {
      log.push(`${attacker.name} braces for impact. 🛡️`);
      continue;
    }
    applyMove(attacker, defender, move, log);
  }

  let status: BattleState['status'] = 'active';
  if (enemy.hp <= 0) status = 'won';
  else if (player.hp <= 0) status = 'lost';

  return {
    player: { ...player, guarding: false },
    enemy: { ...enemy, guarding: false },
    log: [...state.log, ...log],
    round: state.round + 1,
    status,
  };
};

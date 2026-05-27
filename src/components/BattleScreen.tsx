import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { PetState } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  BattleState,
  Move,
  MOVES,
  resolveRound,
  Combatant,
} from '../battle/engine';
import { generateOpponent, playerCombatant, battleReward } from '../battle/opponent';
import {
  fetchPvpOpponent,
  startBattle as startServerBattle,
  battleTurn,
  BattleCombatant,
} from '../battle/pvp';
import { Tactic, TACTICS, TACTIC_ORDER, tacticMatchup } from '../battle/tactics';
import { CreatureSprite } from './CreatureSprite';

type Props = {
  pet: PetState;
  mode?: 'pve' | 'pvp';
  // Local mode (no cloud): the client engine credits the reward / records PvP.
  onReward: (amount: number, enemyLevel: number) => void;
  onResult?: (won: boolean) => void;
  // Cloud mode: the server already credited tokens; sync the new balance.
  onWalletChange?: (tokens: number) => void;
  onExit: () => void;
};

// Cloud delegates to the server-resolved flow; local keeps the interactive
// turn-based engine (which is fine offline because there's nothing to cheat).
export const BattleScreen: React.FC<Props> = (props) =>
  isSupabaseConfigured ? <ServerBattle {...props} /> : <LocalBattle {...props} />;

const newBattle = (pet: PetState, enemy: Combatant, intro: string): BattleState => ({
  player: playerCombatant(pet),
  enemy,
  log: [intro],
  round: 1,
  status: 'active',
});

const HpBar: React.FC<{ c: BattleState['player'] }> = ({ c }) => {
  const pct = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
  const color = pct < 25 ? '#ff5470' : pct < 55 ? '#ffd24d' : '#7fee7f';
  return (
    <View style={styles.hpWrap}>
      <View style={styles.hpHeader}>
        <Text style={styles.cName} numberOfLines={1}>
          {c.name.toUpperCase()}
        </Text>
        <Text style={styles.cLvl}>LV {c.level}</Text>
      </View>
      <View style={styles.hpTrack}>
        <View style={[styles.hpFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.hpText}>
        {c.hp} / {c.maxHp} HP
      </Text>
    </View>
  );
};

const LocalBattle: React.FC<Props> = ({
  pet,
  mode = 'pve',
  onReward,
  onResult,
  onExit,
}) => {
  const isPvp = mode === 'pvp';
  const [phase, setPhase] = useState<'loading' | 'battling' | 'empty'>(
    isPvp ? 'loading' : 'battling'
  );
  const [state, setState] = useState<BattleState | null>(null);
  const rewardedRef = useRef(false);
  const resultRef = useRef(false);
  const [reward, setReward] = useState(0);

  const startBattle = useCallback(async () => {
    rewardedRef.current = false;
    resultRef.current = false;
    setReward(0);
    if (isPvp) {
      setPhase('loading');
      setState(null);
      const enemy = await fetchPvpOpponent();
      if (!enemy) {
        setPhase('empty');
        return;
      }
      setState(newBattle(pet, enemy, `${enemy.name} accepts your challenge!`));
      setPhase('battling');
    } else {
      setState(newBattle(pet, generateOpponent(pet), 'A wild challenger appears!'));
      setPhase('battling');
    }
  }, [isPvp, pet]);

  useEffect(() => {
    startBattle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.status === 'won' && !rewardedRef.current) {
      rewardedRef.current = true;
      const amt = battleReward(state.enemy.level);
      setReward(amt);
      onReward(amt, state.enemy.level);
    }
    if ((state.status === 'won' || state.status === 'lost') && !resultRef.current) {
      resultRef.current = true;
      onResult?.(state.status === 'won');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  const playMove = useCallback((move: Move) => {
    setState((s) => (s && s.status === 'active' ? resolveRound(s, move) : s));
  }, []);

  const title = isPvp ? '⚔️ PvP' : '⚔️ BATTLE';

  if (phase === 'loading') {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.title}>{title}</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Finding an opponent…</Text>
        <Pressable onPress={onExit} style={styles.doneBtn}>
          <Text style={styles.doneText}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'empty' || !state) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.loadingText}>
          No opponents available yet.{'\n'}Invite a friend to raise a pet!
        </Text>
        <Pressable onPress={onExit} style={styles.doneBtn}>
          <Text style={styles.doneText}>BACK</Text>
        </Pressable>
      </View>
    );
  }

  const over = state.status !== 'active';
  const recentLog = state.log.slice(-3);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>EXIT</Text>
        </Pressable>
      </View>

      <View style={styles.arena}>
        {/* Enemy */}
        <HpBar c={state.enemy} />
        <View style={styles.enemySprite}>
          <CreatureSprite
            species={state.enemy.species}
            stage={state.enemy.stage}
            ascended={state.enemy.ascended}
            size={120}
          />
        </View>

        <Text style={styles.vs}>VS</Text>

        {/* Player */}
        <View style={styles.playerSprite}>
          <CreatureSprite
            species={state.player.species}
            stage={state.player.stage}
            ascended={state.player.ascended}
            size={130}
          />
        </View>
        <HpBar c={state.player} />
      </View>

      <View style={styles.logBox}>
        {recentLog.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </View>

      {!over ? (
        <View style={styles.moves}>
          {(Object.keys(MOVES) as Move[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => playMove(m)}
              style={({ pressed }) => [styles.moveBtn, pressed && styles.moveBtnPressed]}
            >
              <Text style={styles.moveIcon}>{MOVES[m].icon}</Text>
              <Text style={styles.moveLabel}>{MOVES[m].label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.resultBox}>
          <Text style={[styles.resultText, state.status === 'won' ? styles.win : styles.lose]}>
            {state.status === 'won' ? 'VICTORY!' : 'DEFEATED…'}
          </Text>
          {state.status === 'won' && (
            <Text style={styles.rewardText}>+✦ {reward} Pixel tokens</Text>
          )}
          <View style={styles.resultButtons}>
            <Pressable onPress={startBattle} style={({ pressed }) => [styles.againBtn, pressed && styles.moveBtnPressed]}>
              <Text style={styles.againText}>{isPvp ? 'NEW OPPONENT' : 'BATTLE AGAIN'}</Text>
            </Pressable>
            <Pressable onPress={onExit} style={({ pressed }) => [styles.doneBtn, pressed && styles.moveBtnPressed]}>
              <Text style={styles.doneText}>DONE</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// Cloud: turn-based battle. The server owns all state — each tactic press is a
// round resolved server-side; we just render the HP it reports back.
const hpView = (c: BattleCombatant, hp: number) => ({
  name: c.name,
  species: c.species,
  stage: c.stage,
  rarity: c.rarity,
  ascended: c.ascended,
  level: c.level,
  attack: c.attack,
  defense: c.defense,
  speed: c.speed,
  maxHp: c.maxHp,
  hp,
  guarding: false,
});

const ServerBattle: React.FC<Props> = ({
  pet,
  mode = 'pve',
  onWalletChange,
  onExit,
}) => {
  const isPvp = mode === 'pvp';
  const [phase, setPhase] = useState<'loading' | 'playing' | 'done' | 'empty'>(
    'loading'
  );
  const [battleId, setBattleId] = useState<string | null>(null);
  const [enemy, setEnemy] = useState<BattleCombatant | null>(null);
  const [player, setPlayer] = useState<BattleCombatant | null>(null);
  const [pHp, setPHp] = useState(0);
  const [eHp, setEHp] = useState(0);
  const [turn, setTurn] = useState(1);
  const [busy, setBusy] = useState(false);
  const [logLine, setLogLine] = useState('');
  const [outcome, setOutcome] = useState<{ won: boolean; reward: number } | null>(
    null
  );
  // Non-empty reason shown on the end screen (egg, error, etc.). Empty string
  // falls back to the default "no opponents" message.
  const [notice, setNotice] = useState('');

  const begin = useCallback(async () => {
    setPhase('loading');
    setEnemy(null);
    setPlayer(null);
    setOutcome(null);
    setLogLine('');
    setBusy(false);
    setNotice('');
    // A freshly hatched pet is an egg for its first ~30s and can't battle yet;
    // catch that locally so the player gets a clear message, not "no opponents".
    if (pet.stage === 'egg' || pet.stage === 'dead') {
      setNotice(
        pet.stage === 'egg'
          ? `${pet.name} is still an egg — let it hatch before it can battle!`
          : `${pet.name} can’t battle right now.`
      );
      setPhase('empty');
      return;
    }
    const res = await startServerBattle(mode, pet.id);
    if (!res) {
      setNotice('Couldn’t reach the arena — check your connection and try again.');
      setPhase('empty');
      return;
    }
    if ('error' in res) {
      setNotice(
        /cannot battle/i.test(res.error)
          ? `${pet.name} isn’t ready to battle yet — try again in a moment.`
          : res.error
      );
      setPhase('empty');
      return;
    }
    if ('empty' in res) {
      setPhase('empty');
      return;
    }
    setBattleId(res.battleId);
    setPlayer(res.player);
    setEnemy(res.enemy);
    setPHp(res.player.hp);
    setEHp(res.enemy.hp);
    setTurn(res.turn);
    setLogLine(
      isPvp ? `${res.enemy.name} accepts your challenge!` : 'A wild challenger appears!'
    );
    setPhase('playing');
  }, [mode, pet.id, pet.name, pet.stage, isPvp]);

  useEffect(() => {
    begin();
  }, [begin]);

  const playTurn = useCallback(
    async (tactic: Tactic) => {
      if (busy || phase !== 'playing' || !battleId) return;
      setBusy(true);
      const res = await battleTurn(battleId, tactic);
      if (!res) {
        setLogLine('Connection hiccup — try that move again.');
        setBusy(false);
        return;
      }
      const mu = tacticMatchup(res.tactic, res.enemyTactic);
      const edge =
        mu === 'advantage' ? ' (your edge)' : mu === 'disadvantage' ? ' (foe’s edge)' : '';
      setLogLine(
        `${TACTICS[res.tactic].icon} you vs ${TACTICS[res.enemyTactic].icon} foe${edge} — ` +
          `you hit ${res.playerDmg}, took ${res.enemyDmg}`
      );
      setPHp(res.playerHp);
      setEHp(res.enemyHp);
      if (res.status === 'active') {
        setTurn(res.turn);
        setBusy(false);
      } else {
        setOutcome({ won: res.status === 'won', reward: res.reward });
        setPhase('done');
        onWalletChange?.(res.tokens);
      }
    },
    [busy, phase, battleId, onWalletChange]
  );

  const title = isPvp ? '⚔️ PvP' : '⚔️ BATTLE';

  if (phase === 'loading') {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.title}>{title}</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Finding an opponent…</Text>
        <Pressable onPress={onExit} style={styles.doneBtn}>
          <Text style={styles.doneText}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'empty' || !enemy || !player) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.loadingText}>
          {notice || 'No opponents available yet.\nInvite a friend to raise a pet!'}
        </Text>
        <Pressable onPress={onExit} style={styles.doneBtn}>
          <Text style={styles.doneText}>BACK</Text>
        </Pressable>
      </View>
    );
  }

  const done = phase === 'done';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>EXIT</Text>
        </Pressable>
      </View>

      <View style={styles.arena}>
        <HpBar c={hpView(enemy, eHp)} />
        <View style={styles.enemySprite}>
          <CreatureSprite
            species={enemy.species}
            stage={enemy.stage}
            ascended={enemy.ascended}
            size={120}
          />
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={styles.playerSprite}>
          <CreatureSprite
            species={player.species}
            stage={player.stage}
            ascended={player.ascended}
            size={130}
          />
        </View>
        <HpBar c={hpView(player, pHp)} />
      </View>

      <View style={styles.logBox}>
        <Text style={styles.logLine}>{logLine}</Text>
      </View>

      {!done ? (
        <>
          <Text style={styles.turnLabel}>TURN {turn} — CHOOSE YOUR TACTIC</Text>
          <View style={styles.moves}>
            {TACTIC_ORDER.map((t) => (
              <Pressable
                key={t}
                disabled={busy}
                onPress={() => playTurn(t)}
                style={({ pressed }) => [
                  styles.moveBtn,
                  pressed && styles.moveBtnPressed,
                  busy && styles.moveBtnDisabled,
                ]}
              >
                <Text style={styles.moveIcon}>{TACTICS[t].icon}</Text>
                <Text style={styles.moveLabel}>{TACTICS[t].label.toUpperCase()}</Text>
                <Text style={styles.moveSub}>{TACTICS[t].stance}</Text>
                <Text style={styles.moveSub}>{TACTICS[t].hint}</Text>
              </Pressable>
            ))}
          </View>
          {busy && <ActivityIndicator color="#fff" style={{ marginTop: 12 }} />}
        </>
      ) : (
        <View style={styles.resultBox}>
          <Text
            style={[styles.resultText, outcome?.won ? styles.win : styles.lose]}
          >
            {outcome?.won ? 'VICTORY!' : 'DEFEATED…'}
          </Text>
          {outcome?.won && (
            <Text style={styles.rewardText}>+✦ {outcome.reward} Pixel tokens</Text>
          )}
          <View style={styles.resultButtons}>
            <Pressable
              onPress={begin}
              style={({ pressed }) => [styles.againBtn, pressed && styles.moveBtnPressed]}
            >
              <Text style={styles.againText}>
                {isPvp ? 'NEW OPPONENT' : 'BATTLE AGAIN'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onExit}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.moveBtnPressed]}
            >
              <Text style={styles.doneText}>DONE</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 16,
    alignItems: 'center',
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 20,
  },
  topBar: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  exit: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  arena: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#cfe9c8',
    borderWidth: 4,
    borderColor: '#0d0620',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  enemySprite: {
    alignItems: 'center',
    marginVertical: 4,
  },
  playerSprite: {
    alignItems: 'center',
    marginVertical: 4,
  },
  vs: {
    fontFamily: 'Courier',
    color: '#2a1a4a',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginVertical: 2,
  },
  hpWrap: {
    width: '100%',
    marginVertical: 4,
  },
  hpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cName: {
    color: '#2a1a4a',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    flexShrink: 1,
  },
  cLvl: {
    color: '#3a2070',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hpTrack: {
    height: 12,
    backgroundColor: '#7a8a72',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0d0620',
    marginTop: 2,
  },
  hpFill: {
    height: '100%',
  },
  hpText: {
    color: '#2a1a4a',
    fontFamily: 'Courier',
    fontSize: 10,
    marginTop: 1,
    textAlign: 'right',
  },
  logBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
    minHeight: 70,
  },
  logLine: {
    color: '#e0d4ff',
    fontFamily: 'Courier',
    fontSize: 12,
    marginVertical: 1,
  },
  moves: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  moveBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#3a2070',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  moveBtnPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#5a30a0',
  },
  moveBtnDisabled: {
    opacity: 0.45,
  },
  moveIcon: {
    fontSize: 24,
  },
  moveLabel: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },
  moveSub: {
    color: '#bfa8f0',
    fontFamily: 'Courier',
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
  },
  turnLabel: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 16,
  },
  resultBox: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    marginTop: 16,
  },
  resultText: {
    fontFamily: 'Courier',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  win: {
    color: '#7fee7f',
  },
  lose: {
    color: '#ff8aa3',
  },
  rewardText: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 6,
  },
  resultButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  againBtn: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 6,
  },
  againText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  doneBtn: {
    backgroundColor: '#3a2070',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 6,
  },
  doneText: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

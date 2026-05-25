import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { PetState } from '../types';
import {
  BattleState,
  Move,
  MOVES,
  resolveRound,
  Combatant,
} from '../battle/engine';
import { generateOpponent, playerCombatant, battleReward } from '../battle/opponent';
import { fetchPvpOpponent } from '../battle/pvp';
import { CreatureSprite } from './CreatureSprite';

type Props = {
  pet: PetState;
  mode?: 'pve' | 'pvp';
  onReward: (amount: number) => void;
  onResult?: (won: boolean) => void;
  onExit: () => void;
};

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

export const BattleScreen: React.FC<Props> = ({
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
      onReward(amt);
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

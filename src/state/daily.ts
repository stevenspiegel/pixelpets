import { supabase } from '../lib/supabase';

// Daily quests + care streak. Quests reward server-verified actions only
// (playing, training, winning a battle), plus a daily check-in that drives the
// streak. Reward amounts MUST match claim_quest() in supabase/schema.sql.
export type QuestId = 'checkin' | 'play' | 'train' | 'win';

export type Quest = {
  id: QuestId;
  label: string;
  icon: string;
  desc: string;
  reward: number; // checkin is dynamic (streak bonus); see checkinReward()
  target: number;
  progressKey?: 'played' | 'trained' | 'won';
};

export const QUESTS: Quest[] = [
  { id: 'checkin', label: 'Daily check-in', icon: '📅', desc: 'Show up and keep your streak going', reward: 0, target: 0 },
  { id: 'play', label: 'Play with your pet', icon: '🎮', desc: 'Play once today', reward: 8, target: 1, progressKey: 'played' },
  { id: 'train', label: 'Train a stat', icon: '💪', desc: 'Train any stat once', reward: 8, target: 1, progressKey: 'trained' },
  { id: 'win', label: 'Win a battle', icon: '⚔️', desc: 'Win a PvE or PvP battle', reward: 12, target: 1, progressKey: 'won' },
];

export type DailyStatus = {
  date: string;
  played: number;
  trained: number;
  won: number;
  claimed: QuestId[];
  streak: number;
  tokens: number;
};

export type ClaimResult = { reward: number; tokens: number; streak: number; claimed: QuestId[] };

export const fetchDailyStatus = async (): Promise<DailyStatus | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('daily_status');
  if (error) {
    console.warn('[pixelpets] daily status error:', error.message);
    return null;
  }
  return data as DailyStatus;
};

export const claimQuest = async (
  id: QuestId
): Promise<ClaimResult | { error: string } | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('claim_quest', { p_quest: id });
  if (error) {
    console.warn('[pixelpets] claim quest error:', error.message);
    return { error: error.message };
  }
  return data as ClaimResult;
};

export const questProgress = (q: Quest, s: DailyStatus): number =>
  q.progressKey ? s[q.progressKey] : 0;

export const questComplete = (q: Quest, s: DailyStatus): boolean =>
  q.id === 'checkin' ? true : questProgress(q, s) >= q.target;

// The check-in's reward grows with the streak (5 + streak, capped at +7),
// matching claim_quest(). Shown as the value the next claim will pay.
export const checkinReward = (streak: number, claimedToday: boolean): number =>
  5 + Math.min(claimedToday ? streak : streak + 1, 7);

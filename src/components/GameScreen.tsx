import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { PetState, ActionKind, StatKey } from '../types';
import { Pet } from './Pet';
import { StatBar } from './StatBar';
import { ActionButton } from './ActionButton';
import { RarityBadge } from './RarityBadge';
import { PetSwitcher } from './PetSwitcher';
import { CreatureSprite } from './CreatureSprite';
import { BattleStats } from './BattleStats';
import { backgroundImage } from '../state/backgrounds';
import { MAX_PETS, speciesName, canAscend, effectiveRarity, EGG_COST, BATTLE_ENERGY_COST } from '../state/usePet';

type Props = {
  pet: PetState;
  pets: PetState[];
  username: string;
  tokens: number;
  onAct: (kind: ActionKind) => void;
  onSwitchPet: (id: string) => void;
  onAddNew: () => void;
  onRemove: () => void;
  onRename: (id: string, name: string) => void;
  onTrain: (stat: StatKey) => void;
  onBattle: () => void;
  onPvp?: () => void;
  onStore?: () => void;
  onDaily?: () => void;
  onLeaderboard?: () => void;
  onPixedex?: () => void;
  onFriends?: () => void;
  onMarketplace?: () => void;
  onBackgrounds?: () => void;
  onSlots?: () => void;
  onBase?: () => void;
  activeBackground?: string;
  onLogOut: () => void;
};

const formatAge = (seconds: number) => {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const confirmRemove = (petName: string, onRemove: () => void) => {
  const msg = `Release ${petName}? This cannot be undone.`;
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(msg)) {
      onRemove();
    }
    return;
  }
  Alert.alert('Release pet?', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Release', style: 'destructive', onPress: onRemove },
  ]);
};

export const GameScreen: React.FC<Props> = ({
  pet,
  pets,
  username,
  tokens,
  onAct,
  onSwitchPet,
  onAddNew,
  onRemove,
  onRename,
  onTrain,
  onBattle,
  onPvp,
  onStore,
  onDaily,
  onLeaderboard,
  onPixedex,
  onFriends,
  onMarketplace,
  onBackgrounds,
  onSlots,
  onBase,
  activeBackground,
  onLogOut,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [statsView, setStatsView] = useState<'care' | 'battle'>('care');
  // PvE + PvP are tucked behind a single BATTLE button to keep the home screen
  // tidy; tapping it reveals the two battle options.
  const [battleOpen, setBattleOpen] = useState(false);
  // Secondary screens are tucked behind a single MENU button to declutter the
  // home screen; tapping it reveals the grid of tiles.
  const [menuOpen, setMenuOpen] = useState(false);
  // Measure the panel's rendered width to force a true square (aspectRatio alone
  // wasn't reliably square, leaving the background cropped/zoomed).
  const [panelW, setPanelW] = useState(0);

  // Leave edit mode when switching to a different pet.
  useEffect(() => {
    setEditingName(false);
  }, [pet.id]);

  const startRename = () => {
    setDraftName(pet.name);
    setEditingName(true);
  };

  const saveRename = () => {
    const clean = draftName.trim();
    if (clean) onRename(pet.id, clean);
    setEditingName(false);
  };

  const status = useMemo(() => {
    if (pet.stage === 'dead') return 'has passed away…';
    if (pet.stage === 'egg') return 'is incubating…';
    if (pet.asleep) return 'is sleeping';
    if (pet.sick) return 'is feeling sick';
    if (pet.hunger < 25) return 'is hungry';
    if (pet.cleanliness < 25) return 'needs a bath';
    if (pet.happiness < 25) return 'is sad';
    if (pet.energy < 20) return 'is sleepy';
    return 'is doing great!';
  }, [pet]);

  const isEgg = pet.stage === 'egg';
  const isDead = pet.stage === 'dead';
  const tooTired = pet.energy < BATTLE_ENERGY_COST;
  const ascendable = canAscend(pet);
  const stageLabel = pet.ascended ? 'ASCENDED' : pet.stage.toUpperCase();
  const bgImage = activeBackground ? backgroundImage(activeBackground) : undefined;

  const menuItems: { key: string; icon: string; label: string; onPress: () => void }[] = [];
  if (onDaily) menuItems.push({ key: 'daily', icon: '📅', label: 'Daily Quests', onPress: onDaily });
  if (onStore) menuItems.push({ key: 'store', icon: '💎', label: 'Buy Tokens', onPress: onStore });
  if (onMarketplace) menuItems.push({ key: 'market', icon: '🏷️', label: 'Marketplace', onPress: onMarketplace });
  if (onLeaderboard) menuItems.push({ key: 'leaderboard', icon: '🏆', label: 'Leaderboard', onPress: onLeaderboard });
  if (onPixedex) menuItems.push({ key: 'pixedex', icon: '📖', label: 'Pixedex', onPress: onPixedex });
  if (onBackgrounds) menuItems.push({ key: 'backgrounds', icon: '🖼️', label: 'Backgrounds', onPress: onBackgrounds });
  if (onSlots) menuItems.push({ key: 'slots', icon: '🎰', label: 'Slots', onPress: onSlots });
  if (onBase) menuItems.push({ key: 'base', icon: '🏡', label: 'Base', onPress: onBase });
  if (onFriends) menuItems.push({ key: 'friends', icon: '👥', label: 'Friends', onPress: onFriends });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.trainer}>@{username}</Text>
        <View style={styles.walletChip}>
          <Text style={styles.walletText}>✦ {tokens}</Text>
        </View>
        <Pressable onPress={onLogOut} hitSlop={8}>
          <Text style={styles.logout}>LOG OUT</Text>
        </Pressable>
      </View>
      <View style={styles.switcherWrap}>
        <PetSwitcher
          pets={pets}
          activeId={pet.id}
          onSwitch={onSwitchPet}
          onAddNew={onAddNew}
          maxPets={MAX_PETS}
          eggCost={EGG_COST}
        />
      </View>
      <View style={styles.header}>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              style={styles.nameInput}
              maxLength={16}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={saveRename}
              returnKeyType="done"
            />
            <Pressable onPress={saveRename} hitSlop={10}>
              <Text style={styles.nameSave}>✓</Text>
            </Pressable>
            <Pressable onPress={() => setEditingName(false)} hitSlop={10}>
              <Text style={styles.nameCancel}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={isEgg ? undefined : startRename}
            style={styles.nameRow}
            disabled={isEgg}
          >
            <Text style={styles.name}>{pet.name.toUpperCase()}</Text>
            {!isEgg && <Text style={styles.pencil}> ✎</Text>}
          </Pressable>
        )}
        <Text style={styles.stageText}>
          {stageLabel}
          {!isEgg ? ` · ${speciesName(pet.species).toUpperCase()}` : ''} ·{' '}
          {formatAge(pet.age)}
        </Text>
        {!isEgg && <RarityBadge rarity={effectiveRarity(pet)} />}
      </View>

      <View style={styles.tama}>
        <View
          style={styles.screen}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w && Math.abs(w - panelW) > 1) setPanelW(w);
          }}
        >
          {/* The background is an explicitly SQUARE image sized to the panel's
              inner width, so it always shows the whole scene (no crop) regardless
              of how tall the panel's content makes it. The pet + status render on
              top. */}
          {bgImage && panelW > 0 && (
            <Image
              source={bgImage}
              style={{ width: panelW, height: panelW, alignSelf: 'center' }}
              resizeMode="contain"
            />
          )}
          <View style={bgImage ? styles.overlayContent : styles.plainContent}>
            <Pet pet={pet} />
            <Text style={[styles.status, bgImage ? styles.statusOnBg : null]}>
              {pet.name} {status}
            </Text>
          </View>
        </View>

        {!isEgg && !isDead && (
          <View style={styles.statsBlock}>
            <View style={styles.statsTabs}>
              <Pressable
                onPress={() => setStatsView('care')}
                style={[styles.statsTab, statsView === 'care' && styles.statsTabActive]}
              >
                <Text
                  style={[styles.statsTabText, statsView === 'care' && styles.statsTabTextActive]}
                >
                  CARE
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setStatsView('battle')}
                style={[styles.statsTab, statsView === 'battle' && styles.statsTabActive]}
              >
                <Text
                  style={[styles.statsTabText, statsView === 'battle' && styles.statsTabTextActive]}
                >
                  BATTLE
                </Text>
              </Pressable>
            </View>

            {statsView === 'care' ? (
              <View style={styles.statsFace}>
                <StatBar label="HUNGER" icon="🍖" color="#ffa040" value={pet.hunger} />
                <StatBar label="HAPPY" icon="❤️" color="#ff5fa2" value={pet.happiness} />
                <StatBar label="CLEAN" icon="🧼" color="#5fc0ff" value={pet.cleanliness} />
                <StatBar label="ENERGY" icon="⚡" color="#ffe34d" value={pet.energy} />
                <StatBar label="HEALTH" icon="💊" color="#7fee7f" value={pet.health} />
              </View>
            ) : (
              <View style={styles.statsFace}>
                <BattleStats pet={pet} tokens={tokens} onTrain={onTrain} />
              </View>
            )}
          </View>
        )}

        {isDead && (
          <Text style={[styles.hint, styles.deadHint]}>
            {pet.name} lived for {formatAge(pet.age)}. Rest in pixels.
          </Text>
        )}
      </View>

      {ascendable && (
        <Pressable
          onPress={() => onAct('ascend')}
          style={({ pressed }) => [
            styles.ascendButton,
            pressed && styles.ascendButtonPressed,
          ]}
        >
          <Text style={styles.ascendText}>✨ ASCEND ✨</Text>
          <Text style={styles.ascendSub}>
            your {speciesName(pet.species).toLowerCase()} is ready to transcend
          </Text>
        </Pressable>
      )}

      {!isEgg && !isDead && (
        <View style={styles.actions}>
          <ActionButton
            icon="🍔"
            label="FEED"
            onPress={() => onAct('feed')}
            disabled={pet.asleep}
          />
          <ActionButton
            icon="🎮"
            label="PLAY"
            onPress={() => onAct('play')}
            disabled={pet.asleep || pet.energy < 10}
          />
          <ActionButton
            icon="🚿"
            label="CLEAN"
            onPress={() => onAct('clean')}
          />
          <ActionButton
            icon={pet.asleep ? '☀️' : '🌙'}
            label={pet.asleep ? 'WAKE' : 'SLEEP'}
            onPress={() => onAct(pet.asleep ? 'wake' : 'sleep')}
          />
          <ActionButton
            icon="💊"
            label="MEDS"
            onPress={() => onAct('medicine')}
            disabled={!pet.sick}
          />
        </View>
      )}

      {!isEgg && !isDead && !battleOpen && (
        <Pressable
          onPress={() => setBattleOpen(true)}
          style={({ pressed }) => [
            styles.battleButton,
            pressed && styles.battleButtonPressed,
          ]}
        >
          <Text style={styles.battleText}>⚔️ BATTLE</Text>
          <Text style={styles.battleSub}>
            {onPvp ? 'fight a wild challenger or another player' : 'fight a wild challenger for ✦ tokens'}
          </Text>
        </Pressable>
      )}

      {!isEgg && !isDead && battleOpen && (
        <>
          {pets.filter((p) => p.stage !== 'egg' && p.stage !== 'dead').length > 1 && (
            <View style={styles.battlePickWrap}>
              <Text style={styles.battlePickLabel}>BATTLE WITH</Text>
              <View style={styles.battlePickRow}>
                {pets
                  .filter((p) => p.stage !== 'egg' && p.stage !== 'dead')
                  .map((p) => {
                    const active = p.id === pet.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => !active && onSwitchPet(p.id)}
                        style={[styles.battlePickChip, active && styles.battlePickChipActive]}
                      >
                        <CreatureSprite
                          species={p.species}
                          stage={p.stage}
                          ascended={p.ascended}
                          size={40}
                        />
                        <Text
                          style={[styles.battlePickName, active && styles.battlePickNameActive]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            </View>
          )}

          <Pressable
            onPress={tooTired ? undefined : onBattle}
            disabled={tooTired}
            style={({ pressed }) => [
              styles.battleButton,
              tooTired && styles.battleButtonDisabled,
              !tooTired && pressed && styles.battleButtonPressed,
            ]}
          >
            <Text style={styles.battleText}>⚔️ WILD BATTLE</Text>
            <Text style={styles.battleSub}>
              {tooTired ? `too tired — let ${pet.name} rest` : 'fight a wild challenger for ✦ tokens'}
            </Text>
          </Pressable>

          {onPvp && (
            <Pressable
              onPress={tooTired ? undefined : onPvp}
              disabled={tooTired}
              style={({ pressed }) => [
                styles.pvpButton,
                tooTired && styles.battleButtonDisabled,
                !tooTired && pressed && styles.battleButtonPressed,
              ]}
            >
              <Text style={styles.battleText}>🤺 PvP BATTLE</Text>
              <Text style={styles.battleSub}>
                {tooTired ? `too tired — let ${pet.name} rest` : "challenge another player's pet"}
              </Text>
            </Pressable>
          )}

          <Pressable onPress={() => setBattleOpen(false)} style={styles.battleCancel} hitSlop={8}>
            <Text style={styles.battleCancelText}>← back</Text>
          </Pressable>
        </>
      )}

      {menuItems.length > 0 && !menuOpen && (
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.menuToggle, pressed && styles.menuTilePressed]}
        >
          <Text style={styles.menuToggleText}>☰ MENU</Text>
        </Pressable>
      )}

      {menuItems.length > 0 && menuOpen && (
        <View style={styles.menuSection}>
          <View style={styles.menuHeaderRow}>
            <Text style={styles.menuHeader}>MENU</Text>
            <Pressable onPress={() => setMenuOpen(false)} hitSlop={8}>
              <Text style={styles.menuClose}>✕ CLOSE</Text>
            </Pressable>
          </View>
          <View style={styles.menuGrid}>
            {menuItems.map((m) => (
              <Pressable
                key={m.key}
                onPress={m.onPress}
                style={({ pressed }) => [styles.menuTile, pressed && styles.menuTilePressed]}
              >
                <Text style={styles.menuIcon}>{m.icon}</Text>
                <Text style={styles.menuLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={() => confirmRemove(pet.name, onRemove)}
        style={styles.dangerButton}
        hitSlop={8}
      >
        <Text style={styles.dangerText}>
          {isDead ? `⚰️ bury ${pet.name.toLowerCase()}` : `release ${pet.name.toLowerCase()}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 16,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  trainer: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 1,
  },
  walletChip: {
    backgroundColor: '#3a2070',
    borderWidth: 2,
    borderColor: '#ffd24d',
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  walletText: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  logout: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  switcherWrap: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 3,
    ...(Platform.select({
      web: { textShadow: '2px 2px 0 #7a4ed0' },
      default: {
        textShadowColor: '#7a4ed0',
        textShadowOffset: { width: 2, height: 2 },
      },
    }) as object),
  },
  pencil: {
    color: '#8a76c0',
    fontSize: 16,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 160,
    textAlign: 'center',
  },
  nameSave: {
    color: '#7fee7f',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  nameCancel: {
    color: '#ff8aa3',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  stageText: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 2,
  },
  tama: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#3a2070',
    borderWidth: 4,
    borderColor: '#7a4ed0',
    borderRadius: 24,
    padding: 14,
  },
  screen: {
    backgroundColor: '#cfe9c8',
    borderWidth: 4,
    borderColor: '#0d0620',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  // Pet + status overlaid on top of the square background image.
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No-background (Classic) case: keep the original padded panel look.
  plainContent: {
    padding: 12,
    alignItems: 'center',
    width: '100%',
  },
  status: {
    fontFamily: 'Courier',
    color: '#2a1a4a',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  // On a background scene the dark status text gets lost — switch to white with
  // a dark shadow/outline so it's readable against any background.
  statusOnBg: {
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statsBlock: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  statsTabs: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  statsTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#2a1a4a',
  },
  statsTabActive: {
    backgroundColor: '#7a4ed0',
  },
  statsTabText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statsTabTextActive: {
    color: '#fff',
  },
  statsFace: {
    minHeight: 150,
  },
  hint: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },
  deadHint: {
    color: '#ff9bb3',
  },
  actions: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  ascendButton: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    backgroundColor: '#6a4a0a',
    borderWidth: 3,
    borderColor: '#ffd24d',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ascendButtonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#8a6310',
  },
  ascendText: {
    color: '#ffe9a0',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  ascendSub: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 1,
  },
  battleButton: {
    width: '100%',
    maxWidth: 380,
    marginTop: 16,
    backgroundColor: '#7a1f3a',
    borderWidth: 3,
    borderColor: '#ff5470',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  battleButtonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#9a2a4a',
  },
  battleButtonDisabled: {
    opacity: 0.45,
  },
  pvpButton: {
    width: '100%',
    maxWidth: 380,
    marginTop: 10,
    backgroundColor: '#1f3a6a',
    borderWidth: 3,
    borderColor: '#5fc0ff',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  battleText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  battleSub: {
    color: '#ffd0db',
    fontFamily: 'Courier',
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 1,
  },
  battleCancel: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 2,
  },
  battlePickWrap: {
    marginBottom: 8,
  },
  battlePickLabel: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  battlePickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  battlePickChip: {
    alignItems: 'center',
    width: 64,
    paddingVertical: 6,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#3a2a5a',
    borderRadius: 6,
  },
  battlePickChipActive: {
    borderColor: '#ff5470',
    backgroundColor: '#3a1a3a',
  },
  battlePickName: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 10,
    marginTop: 2,
    maxWidth: 56,
  },
  battlePickNameActive: {
    color: '#ffd0db',
  },
  battleCancelText: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
  },
  menuSection: {
    width: '100%',
    maxWidth: 380,
    marginTop: 22,
  },
  menuHeader: {
    color: '#bfa8f0',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 8,
    marginLeft: 2,
  },
  menuToggle: {
    width: '100%',
    maxWidth: 380,
    marginTop: 22,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  menuToggleText: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 2,
  },
  menuClose: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuTile: {
    width: '48%',
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  menuTilePressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#3a2070',
  },
  menuIcon: {
    fontSize: 22,
  },
  menuLabel: {
    color: '#e0d4ff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 5,
  },
  dangerButton: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  dangerText: {
    color: '#c0607a',
    fontFamily: 'Courier',
    fontSize: 12,
    letterSpacing: 2,
  },
});

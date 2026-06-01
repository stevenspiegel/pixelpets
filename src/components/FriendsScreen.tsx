import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import {
  Friend,
  FriendPet,
  sendFriendRequest,
  listFriends,
  listFriendRequests,
  respondFriendRequest,
  removeFriend,
  getFriendPets,
  friendPetToPet,
} from '../social/friends';
import { battleStats, speciesName } from '../state/usePet';
import { CreatureSprite } from './CreatureSprite';
import { RarityBadge } from './RarityBadge';

type Props = {
  onExit: () => void;
  // Start a casual battle against a friend's pet. canBattle is false when the
  // player has no active (non-egg/dead) pet to fight with.
  canBattle?: boolean;
  onBattle?: (opponentPetId: string) => void;
};

export const FriendsScreen: React.FC<Props> = ({ onExit, canBattle, onBattle }) => {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Friend | null>(null);

  const refresh = useCallback(async () => {
    const [f, r] = await Promise.all([listFriends(), listFriendRequests()]);
    setFriends(f);
    setRequests(r);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await sendFriendRequest(draft);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotice(
      res.status === 'accepted'
        ? `You're now friends with ${draft.trim()}!`
        : `Request sent to ${draft.trim()}.`
    );
    setDraft('');
    refresh();
  };

  const onRespond = async (fromUser: string, accept: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await respondFriendRequest(fromUser, accept);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    refresh();
  };

  const onRemove = async (username: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await removeFriend(username);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    refresh();
  };

  const confirmUnfriend = (username: string, onConfirm: () => void) => {
    const msg = `Unfriend @${username}? They'll have to send a new request to reconnect.`;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(msg)) onConfirm();
      return;
    }
    Alert.alert('Unfriend?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfriend', style: 'destructive', onPress: onConfirm },
    ]);
  };

  if (selected) {
    return (
      <FriendProfile
        friend={selected}
        canBattle={canBattle}
        onBattle={onBattle}
        onBack={() => setSelected(null)}
        onRemove={() =>
          confirmUnfriend(selected.username, () => {
            onRemove(selected.username);
            setSelected(null);
          })
        }
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>👥 FRIENDS</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="add by username"
          placeholderTextColor="#8a76c0"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          onSubmitEditing={onSend}
        />
        <Pressable onPress={onSend} disabled={busy} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{busy ? '…' : 'ADD'}</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      {requests.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.sectionLabel}>FRIEND REQUESTS</Text>
          {requests.map((u) => (
            <View key={u} style={styles.friendRow}>
              <Text style={styles.friendName}>@{u}</Text>
              <View style={styles.reqButtons}>
                <Pressable onPress={() => onRespond(u, true)} hitSlop={6}>
                  <Text style={styles.accept}>accept</Text>
                </Pressable>
                <Pressable onPress={() => onRespond(u, false)} hitSlop={6}>
                  <Text style={styles.decline}>decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {friends === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : friends.length === 0 ? (
        <Text style={styles.empty}>
          No friends yet. Add someone by their username above!
        </Text>
      ) : (
        <View style={styles.list}>
          {requests.length > 0 && <Text style={styles.sectionLabel}>FRIENDS</Text>}
          {friends.map((f) => (
            <Pressable
              key={f.username}
              onPress={() => setSelected(f)}
              style={({ pressed }) => [styles.friendRow, pressed && styles.rowPressed]}
            >
              <Text style={styles.friendName}>@{f.username}</Text>
              <Text style={styles.friendMeta}>
                {f.petCount} 🐾 · {f.wins}W/{f.losses}L
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const FriendProfile: React.FC<{
  friend: Friend;
  canBattle?: boolean;
  onBattle?: (opponentPetId: string) => void;
  onBack: () => void;
  onRemove: () => void;
}> = ({ friend, canBattle, onBattle, onBack, onRemove }) => {
  const [pets, setPets] = useState<FriendPet[] | null>(null);

  useEffect(() => {
    let active = true;
    getFriendPets(friend.username).then((p) => {
      if (active) setPets(p);
    });
    return () => {
      active = false;
    };
  }, [friend.username]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={[styles.topBar, { justifyContent: 'flex-end' }]}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      <Text style={styles.profileName}>@{friend.username}</Text>
      <Text style={styles.profileMeta}>
        PvP {friend.wins}W · {friend.losses}L
      </Text>

      {pets === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : pets.length === 0 ? (
        <Text style={styles.empty}>No pets to show.</Text>
      ) : (
        <View style={styles.petGrid}>
          {pets.map((fp) => {
            const stats = battleStats(friendPetToPet(fp));
            const showSprite = fp.stage !== 'egg' && fp.stage !== 'dead';
            return (
              <View key={fp.id} style={styles.petCard}>
                {showSprite ? (
                  <CreatureSprite
                    species={fp.species}
                    stage={fp.stage}
                    ascended={fp.ascended}
                    size={64}
                  />
                ) : (
                  <Image
                    source={
                      fp.stage === 'dead'
                        ? require('../../assets/ghost.png')
                        : require('../../assets/egg.gif')
                    }
                    style={styles.eggImage}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.petName} numberOfLines={1}>
                  {fp.name}
                </Text>
                <Text style={styles.petKind}>
                  LV {stats.level} · {speciesName(fp.species)}
                </Text>
                <RarityBadge rarity={fp.ascended ? 'mythical' : fp.rarity} />
                {showSprite && onBattle && (
                  <Pressable
                    onPress={() => canBattle && onBattle(fp.id)}
                    disabled={!canBattle}
                    style={({ pressed }) => [
                      styles.battleBtn,
                      !canBattle && styles.battleBtnDisabled,
                      canBattle && pressed && styles.battleBtnPressed,
                    ]}
                    hitSlop={6}
                  >
                    <Text style={styles.battleBtnText}>⚔️ BATTLE</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => [styles.removeFriendBtn, pressed && styles.removeFriendBtnPressed]}
      >
        <Text style={styles.removeFriendText}>REMOVE FRIEND</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, alignItems: 'center' },
  topBar: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  exit: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  removeFriendBtn: {
    marginTop: 28,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: '#7a2a3a',
    borderRadius: 4,
    alignSelf: 'center',
  },
  removeFriendBtnPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#3a1a2a',
  },
  removeFriendText: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  addRow: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 14,
  },
  addBtn: {
    marginLeft: 8,
    backgroundColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  error: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    marginTop: 8,
  },
  notice: {
    color: '#7fee7f',
    fontFamily: 'Courier',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 340,
  },
  sectionLabel: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 6,
  },
  reqButtons: {
    flexDirection: 'row',
  },
  accept: {
    color: '#7fee7f',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  decline: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    marginLeft: 12,
  },
  empty: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 320,
    lineHeight: 20,
  },
  list: {
    width: '100%',
    maxWidth: 380,
    marginTop: 14,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowPressed: { backgroundColor: '#3a2070' },
  friendName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
  },
  friendMeta: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  profileName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 6,
  },
  profileMeta: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    marginBottom: 16,
  },
  petGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 380,
  },
  petCard: {
    width: 100,
    alignItems: 'center',
    margin: 6,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 8,
  },
  battleBtn: {
    marginTop: 6,
    backgroundColor: '#ff5470',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  battleBtnPressed: {
    backgroundColor: '#e23a5a',
  },
  battleBtnDisabled: {
    backgroundColor: '#4a3a5a',
    opacity: 0.7,
  },
  battleBtnText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  eggEmoji: {
    fontSize: 48,
    lineHeight: 64,
  },
  eggImage: {
    width: 64,
    height: 64,
  },
  petName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    maxWidth: 90,
  },
  petKind: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 10,
    marginBottom: 4,
  },
});

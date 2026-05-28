import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PetState } from '../types';
import {
  Listing,
  listAdoptions,
  listPetForAdoption,
  cancelListing,
  adoptPet,
  listingToPet,
} from '../social/marketplace';
import { battleStats, speciesName } from '../state/usePet';
import { CreatureSprite } from './CreatureSprite';
import { RarityBadge } from './RarityBadge';

type Props = {
  pets: PetState[];
  activeId: string | null;
  tokens: number;
  username: string;
  onReload: () => Promise<void> | void;
  onExit: () => void;
};

export const MarketplaceScreen: React.FC<Props> = ({
  pets,
  activeId,
  tokens,
  username,
  onReload,
  onExit,
}) => {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await listAdoptions();
    setListings(data);
  }, []);

  useEffect(() => {
    // Reload the player's own collection (catches pets sold while away), then
    // load the current market.
    Promise.resolve(onReload()).finally(refresh);
  }, [onReload, refresh]);

  const myListingIds = new Set(
    (listings ?? [])
      .filter((l) => l.sellerUsername === username)
      .map((l) => l.petId)
  );

  const onAdopt = async (l: Listing) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await adoptPet(l.petId);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setNotice(`You adopted ${l.name}!`);
    await Promise.resolve(onReload());
    await refresh();
    setBusy(false);
  };

  const onList = async (pet: PetState) => {
    if (busy) return;
    const raw = drafts[pet.id] ?? '';
    const price = Math.max(0, Math.floor(Number(raw)));
    if (!raw || Number.isNaN(price)) {
      setError('Enter a price for ' + pet.name);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await listPetForAdoption(pet.id, price);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setNotice(`${pet.name} is up for adoption for ✦ ${price}.`);
    setDrafts((d) => ({ ...d, [pet.id]: '' }));
    await refresh();
    setBusy(false);
  };

  const onCancel = async (petId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    await cancelListing(petId);
    await refresh();
    setBusy(false);
  };

  const sellable = pets.filter(
    (p) => p.id !== activeId && p.stage !== 'egg' && p.stage !== 'dead'
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🏷️ MARKET</Text>
        <View style={styles.walletChip}>
          <Text style={styles.walletText}>✦ {tokens}</Text>
        </View>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Text style={styles.sectionLabel}>UP FOR ADOPTION</Text>
      {listings === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : listings.length === 0 ? (
        <Text style={styles.empty}>
          No pets are up for adoption right now. List one of yours below!
        </Text>
      ) : (
        <View style={styles.grid}>
          {listings.map((l) => {
            const stats = battleStats(listingToPet(l));
            const mine = l.sellerUsername === username;
            const showSprite = l.stage !== 'egg' && l.stage !== 'dead';
            const affordable = tokens >= l.price;
            return (
              <View key={l.petId} style={styles.card}>
                {showSprite ? (
                  <CreatureSprite
                    species={l.species}
                    stage={l.stage}
                    ascended={l.ascended}
                    size={64}
                  />
                ) : (
                  <Text style={styles.eggEmoji}>🥚</Text>
                )}
                <Text style={styles.petName} numberOfLines={1}>
                  {l.name}
                </Text>
                <Text style={styles.petKind}>
                  LV {stats.level} · {speciesName(l.species)}
                </Text>
                <RarityBadge rarity={l.ascended ? 'mythical' : l.rarity} />
                <Text style={styles.price}>{l.price === 0 ? 'FREE' : `✦ ${l.price}`}</Text>
                <Text style={styles.seller} numberOfLines={1}>
                  @{l.sellerUsername}
                </Text>
                {mine ? (
                  <Pressable
                    onPress={() => onCancel(l.petId)}
                    disabled={busy}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>CANCEL</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => onAdopt(l)}
                    disabled={busy || !affordable}
                    style={[styles.adoptBtn, !affordable && styles.btnDisabled]}
                  >
                    <Text style={styles.adoptBtnText}>
                      {affordable ? 'ADOPT' : 'NEED ✦'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
        PUT A PET UP FOR ADOPTION
      </Text>
      {pets.length <= 1 ? (
        <Text style={styles.empty}>
          You need more than one pet before you can give one up for adoption.
        </Text>
      ) : sellable.length === 0 ? (
        <Text style={styles.empty}>
          Switch to a different active pet to list one of your others.
        </Text>
      ) : (
        <View style={styles.list}>
          {sellable.map((pet) => {
            const listed = myListingIds.has(pet.id);
            return (
              <View key={pet.id} style={styles.sellRow}>
                <View style={styles.sellInfo}>
                  <Text style={styles.sellName} numberOfLines={1}>
                    {pet.name}
                  </Text>
                  <Text style={styles.sellKind}>
                    LV {pet.level} · {speciesName(pet.species)}
                  </Text>
                </View>
                {listed ? (
                  <Pressable
                    onPress={() => onCancel(pet.id)}
                    disabled={busy}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelBtnText}>UNLIST</Text>
                  </Pressable>
                ) : (
                  <View style={styles.sellActions}>
                    <TextInput
                      value={drafts[pet.id] ?? ''}
                      onChangeText={(t) =>
                        setDrafts((d) => ({ ...d, [pet.id]: t.replace(/[^0-9]/g, '') }))
                      }
                      placeholder="price"
                      placeholderTextColor="#8a76c0"
                      style={styles.priceInput}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <Pressable
                      onPress={() => onList(pet)}
                      disabled={busy}
                      style={styles.listBtn}
                    >
                      <Text style={styles.listBtnText}>LIST</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
  walletChip: {
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  walletText: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
  },
  exit: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  error: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 340,
  },
  notice: {
    color: '#7fee7f',
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 340,
  },
  sectionLabel: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  empty: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 380,
  },
  card: {
    width: 110,
    alignItems: 'center',
    margin: 6,
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  eggEmoji: { fontSize: 48, lineHeight: 64 },
  petName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    maxWidth: 100,
  },
  petKind: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 10,
    marginBottom: 4,
  },
  price: {
    color: '#ffd24d',
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  seller: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 10,
    maxWidth: 100,
    marginBottom: 6,
  },
  adoptBtn: {
    backgroundColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  adoptBtnText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  btnDisabled: { backgroundColor: '#4a3a5a', opacity: 0.7 },
  cancelBtn: {
    borderWidth: 2,
    borderColor: '#ff8aa3',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cancelBtnText: {
    color: '#ff8aa3',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  list: { width: '100%', maxWidth: 380 },
  sellRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sellInfo: { flex: 1, marginRight: 8 },
  sellName: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sellKind: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
  },
  sellActions: { flexDirection: 'row', alignItems: 'center' },
  priceInput: {
    width: 70,
    backgroundColor: '#1a0d2e',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 13,
    marginRight: 6,
  },
  listBtn: {
    backgroundColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  listBtnText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { PetState } from '../types';
import { decorArt, buildingArt, wallArt } from '../base/images';
import {
  BASE_GRID,
  BASE_DECOR,
  BASE_FLOORS,
  decorById,
  floorColor,
  fetchBase,
  unlockDecor,
  saveBaseLayout,
  refillDecor,
  functionalStat,
  REFILL_COST,
  FUEL_FILL_MS,
  Placed,
  PlacedPet,
  BaseState,
  buildingById,
  isReady,
  collectStructure,
  BuildingState,
  BUILDINGS,
  buildStructure,
  upgradeStructure,
  isWall,
  wallMask,
} from '../state/base';
import { CreatureSprite } from './CreatureSprite';

type Props = {
  pets: PetState[];
  tokens: number;
  onWalletChange: (tokens: number) => void;
  onExit: () => void;
  // Dev harness only: seed the board from this state and skip the server
  // fetch, so the base can be previewed without Supabase/auth (see
  // src/dev/BasePreview.tsx). Editing still works in-memory; Save won't persist.
  preview?: BaseState;
};

// Cell size for the rendered grid (square board, scaled to fit ~340px).
const BOARD = 336;
const CELL = BOARD / BASE_GRID;

// Renders a decoration's PNG art when present (assets/base/<id>.png), falling
// back to the catalog emoji glyph until real art is dropped in.
const DecorIcon: React.FC<{ id: string; size: number; bleed?: boolean }> = ({ id, size, bleed }) => {
  const art = decorArt(id);
  if (art) {
    // Tiling items (fences) fill the cell so neighbours touch; everything else
    // is contained with a little breathing room.
    return <Image source={art} style={{ width: size, height: size }} resizeMode={bleed ? 'cover' : 'contain'} />;
  }
  return (
    <Text style={{ fontSize: size * 0.78, lineHeight: size }}>
      {decorById(id)?.glyph ?? '?'}
    </Text>
  );
};

// Renders a building's PNG art (assets/base/<id>.png), falling back to its glyph.
const BuildingIcon: React.FC<{ id: string; size: number }> = ({ id, size }) => {
  const art = buildingArt(id);
  if (art) return <Image source={art} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Text style={{ fontSize: size * 0.78, lineHeight: size }}>{buildingById(id)?.glyph ?? '?'}</Text>;
};

export const BaseScreen: React.FC<Props> = ({ pets, tokens, onWalletChange, onExit, preview }) => {
  const [owned, setOwned] = useState<string[] | null>(preview ? preview.owned : null);
  const [layout, setLayout] = useState<Placed[]>(preview ? preview.layout : []);
  const [placedPets, setPlacedPets] = useState<PlacedPet[]>(preview ? preview.pets : []);
  const [floor, setFloor] = useState(preview ? preview.floor : 'grass');
  const [editing, setEditing] = useState(false);
  // What a tile-tap will do: a decor id to place, 'erase', or 'pet:<id>' to
  // place a specific pet on the grid.
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [fuel, setFuel] = useState<Record<string, number>>(preview ? preview.fuel : {});
  const [buildings, setBuildings] = useState<Record<string, BuildingState>>(preview ? preview.buildings : {});
  const [eggShards, setEggShards] = useState<number>(preview ? preview.eggShards : 0);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (preview) return; // dev harness seeds state directly; no server fetch
    let on = true;
    fetchBase().then((b) => {
      if (!on) return;
      setOwned(b.owned);
      setLayout(b.layout);
      setPlacedPets(b.pets);
      setFloor(b.floor);
      setFuel(b.fuel);
      setBuildings(b.buildings);
      setEggShards(b.eggShards);
    });
    return () => {
      on = false;
    };
  }, [preview]);

  // Re-render once a minute so readiness badges update without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Living (non-egg/dead) pets that mill about the base.
  const livePets = pets.filter((p) => p.stage !== 'egg' && p.stage !== 'dead');
  const livePetById = (id: string) => livePets.find((p) => p.id === id);
  // Only keep placements for pets that still exist + are alive.
  const validPlaced = placedPets.filter((pp) => !!livePetById(pp.petId));
  // Pets without a chosen spot fall back to the auto wandering row.
  const unplacedPets = livePets.filter(
    (p) => !validPlaced.some((pp) => pp.petId === p.id)
  );

  const onCell = (x: number, y: number) => {
    if (!editing || !selected) return;
    setError(null);
    if (selected === 'erase') {
      setLayout((l) => l.filter((p) => !(p.x === x && p.y === y)));
      setPlacedPets((pp) => pp.filter((p) => !(p.x === x && p.y === y)));
      setDirty(true);
      return;
    }
    if (selected.startsWith('pet:')) {
      const petId = selected.slice(4);
      setPlacedPets((pp) => {
        // Remove this pet from any prior cell + clear whatever pet sits on the
        // target cell, so it's one pet per cell.
        const without = pp.filter((p) => p.petId !== petId && !(p.x === x && p.y === y));
        return [...without, { petId, x, y }];
      });
      setDirty(true);
      return;
    }
    if (selected.startsWith('build:')) {
      const type = selected.slice(6);
      if (busy) return;
      // Reject locally if the cell is taken (server also enforces this).
      if (layout.some((p) => p.x === x && p.y === y) ||
          Object.values(buildings).some((b) => b.x === x && b.y === y)) {
        setError('Cell occupied');
        return;
      }
      setBusy(true);
      setError(null);
      buildStructure(type as any, x, y).then((res) => {
        setBusy(false);
        if (!res.ok) { setError(res.error); return; }
        setBuildings(res.value.buildings);
        onWalletChange(res.value.tokens);
        setSelected(null);
      });
      return;
    }
    setLayout((l) => {
      const without = l.filter((p) => !(p.x === x && p.y === y)); // one item per cell
      return [...without, { id: selected, x, y }];
    });
    setDirty(true);
  };

  const onUnlock = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await unlockDecor(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOwned(res.value.owned);
    onWalletChange(res.value.tokens);
    // The server grants a free first fill on a functional purchase; reflect it
    // locally so the gauge reads ~48h right away (matches unlock_decor).
    if (functionalStat(id)) {
      setFuel((f) => ({ ...f, [id]: Date.now() + FUEL_FILL_MS }));
    }
  };

  const fuelLabel = (id: string): string => {
    const msLeft = (fuel[id] ?? 0) - Date.now();
    if (msLeft <= 0) return 'Empty';
    return `Fueled · ${Math.ceil(msLeft / 3600000)}h left`;
  };

  const onRefill = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await refillDecor(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFuel(res.value.fuel);
    onWalletChange(res.value.tokens);
  };

  const onCollect = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await collectStructure(id as any);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBuildings(res.value.buildings);
    setEggShards(res.value.eggShards);
    onWalletChange(res.value.tokens);
    setNow(Date.now());
  };

  const onBuildSelect = (id: string) => {
    // Selecting an unbuilt building arms placement; the actual build happens on
    // the first tile tap (see onCell). Owned buildings can't be re-placed.
    setSelected(`build:${id}`);
  };

  const onUpgrade = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await upgradeStructure(id as any);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBuildings(res.value.buildings);
    setEggShards(res.value.eggShards);
    onWalletChange(res.value.tokens);
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await saveBaseLayout(layout, floor, validPlaced);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDirty(false);
    setEditing(false);
    setSelected(null);
  };

  const isOwned = (id: string) => owned?.includes(id);

  // Build a quick lookup for what's placed where.
  const placedAt = (x: number, y: number) => layout.find((p) => p.x === x && p.y === y);

  // Coords of every wall cell, for O(1) neighbour lookup when auto-tiling.
  const wallSet = new Set(
    layout.filter((p) => isWall(p.id)).map((p) => `${p.x},${p.y}`)
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Text style={styles.title}>🏡 BASE</Text>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.exit}>BACK</Text>
        </Pressable>
      </View>
      <Text style={styles.wallet}>you have ✦ {tokens}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {owned === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
      ) : (
        <>
          {/* The board: floor + grid cells with decor; pets overlaid on top. */}
          <View style={[styles.board, { backgroundColor: floorColor(floor) }]}>
            {Array.from({ length: BASE_GRID }).map((_, y) => (
              <View key={y} style={styles.row}>
                {Array.from({ length: BASE_GRID }).map((_, x) => {
                  const here = placedAt(x, y);
                  const wall = here ? isWall(here.id) : false;
                  const tile = here ? decorById(here.id)?.tile : false;
                  const wallSrc = wall ? wallArt(wallMask(wallSet, x, y)) : undefined;
                  return (
                    <Pressable
                      key={x}
                      onPress={() => onCell(x, y)}
                      style={[styles.cell, editing && styles.cellEditing]}
                    >
                      {wall && wallSrc ? (
                        <Image source={wallSrc} style={{ width: CELL, height: CELL }} resizeMode="cover" />
                      ) : (
                        here && <DecorIcon id={here.id} size={tile ? CELL : CELL * 0.78} bleed={tile} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {/* Pets placed on specific cells render anchored to their tile
                (both view + edit). pointerEvents none so edit taps reach the
                cell beneath. */}
            {validPlaced.map((pp) => {
              const pet = livePetById(pp.petId);
              if (!pet) return null;
              return (
                <View
                  key={pp.petId}
                  pointerEvents="none"
                  style={[styles.placedPet, { left: pp.x * CELL, top: pp.y * CELL }]}
                >
                  <CreatureSprite species={pet.species} stage={pet.stage} ascended={pet.ascended} size={CELL * 0.82} />
                </View>
              );
            })}

            {/* Buildings sit on their grid cell. In view mode a ready building is
                tappable to collect and shows a badge; in edit mode taps fall
                through to the cell (placement/erase handled by the shop). */}
            {Object.entries(buildings).map(([id, st]) => {
              const def = buildingById(id);
              if (!def) return null;
              const ready = !editing && isReady(def, st, now);
              return (
                <Pressable
                  key={id}
                  pointerEvents={editing ? 'none' : 'auto'}
                  onPress={() => ready && onCollect(id)}
                  style={[styles.placedPet, { left: st.x * CELL, top: st.y * CELL }]}
                >
                  <BuildingIcon id={id} size={CELL * 0.82} />
                  {ready && (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>{def.ready}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* Pets without a chosen spot wander in a simple wrapping row. View
                mode only — hidden while editing so they don't clutter. */}
            {!editing && unplacedPets.length > 0 && (
              <View style={styles.petLayer} pointerEvents="none">
                {unplacedPets.map((p) => (
                  <View key={p.id} style={styles.petSlot}>
                    <CreatureSprite species={p.species} stage={p.stage} ascended={p.ascended} size={44} />
                  </View>
                ))}
              </View>
            )}
          </View>

          {!editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.primaryBtnText}>✏️ EDIT BASE</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.editBar}>
                <Pressable
                  onPress={onSave}
                  disabled={busy}
                  style={({ pressed }) => [styles.saveBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.primaryBtnText}>{busy ? '…' : dirty ? '✓ SAVE' : 'DONE'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelected('erase')}
                  style={[styles.eraseBtn, selected === 'erase' && styles.toolActive]}
                >
                  <Text style={styles.eraseText}>🧽 ERASE</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>
                {selected?.startsWith('build:')
                  ? 'Tap an empty tile to build it here.'
                  : selected === 'erase'
                  ? 'Tap a tile to clear its decoration or pet.'
                  : selected?.startsWith('pet:')
                  ? 'Tap a tile to move this pet there.'
                  : selected
                  ? 'Tap a tile to place it. Tap an item below to switch.'
                  : 'Pick a pet or item below, then tap a tile to place it.'}
              </Text>

              {/* Pet placement palette */}
              {livePets.length > 0 && (
                <>
                  <Text style={styles.shopHeader}>PETS</Text>
                  <View style={styles.shopRow}>
                    {livePets.map((p) => {
                      const active = selected === `pet:${p.id}`;
                      const isPlaced = validPlaced.some((pp) => pp.petId === p.id);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelected(`pet:${p.id}`)}
                          style={[styles.shopCard, active && styles.shopCardActive]}
                        >
                          <CreatureSprite species={p.species} stage={p.stage} ascended={p.ascended} size={34} />
                          <Text style={styles.shopName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.shopPrice}>
                            {active ? 'PLACING' : isPlaced ? 'MOVE' : 'PLACE'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Floor picker */}
              <Text style={styles.shopHeader}>FLOOR</Text>
              <View style={styles.shopRow}>
                {BASE_FLOORS.map((f) => {
                  const ownedFloor = f.price === 0 || isOwned(f.id);
                  const active = floor === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        if (ownedFloor) {
                          setFloor(f.id);
                          setDirty(true);
                        } else {
                          onUnlock(f.id);
                        }
                      }}
                      style={[styles.shopCard, active && styles.shopCardActive]}
                    >
                      <View style={[styles.floorSwatch, { backgroundColor: f.color }]} />
                      <Text style={styles.shopName}>{f.name}</Text>
                      <Text style={styles.shopPrice}>
                        {ownedFloor ? (active ? 'ON' : 'SET') : `✦ ${f.price}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Decoration shop / palette */}
              <Text style={styles.shopHeader}>DECORATIONS</Text>
              <View style={styles.shopGrid}>
                {BASE_DECOR.map((d) => {
                  const own = isOwned(d.id);
                  const active = selected === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => (own ? setSelected(d.id) : onUnlock(d.id))}
                      style={[styles.shopCard, active && styles.shopCardActive]}
                    >
                      <DecorIcon id={d.id} size={34} />
                      <Text style={styles.shopName} numberOfLines={1}>{d.name}</Text>
                      <Text style={styles.shopPrice}>{own ? (active ? 'SELECTED' : 'PLACE') : `✦ ${d.price}`}</Text>
                      {functionalStat(d.id) && own && (
                        <>
                          <Text style={styles.fuelText}>{fuelLabel(d.id)}</Text>
                          <Pressable
                            onPress={() => onRefill(d.id)}
                            disabled={busy || tokens < REFILL_COST}
                            style={[
                              styles.refillBtn,
                              (busy || tokens < REFILL_COST) && styles.refillBtnDisabled,
                            ]}
                          >
                            <Text style={styles.refillBtnText}>Refill ({REFILL_COST})</Text>
                          </Pressable>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Buildings: one-of-each, upgradeable. Unbuilt → arm placement;
                  built → show level + Upgrade. */}
              <Text style={styles.shopHeader}>BUILDINGS</Text>
              {eggShards > 0 && (
                <View style={styles.shardsMeter}>
                  <Image
                    source={require('../../assets/egg-icon.png')}
                    style={styles.shardsEgg}
                    resizeMode="contain"
                  />
                  <Text style={styles.fuelText}>shards: {eggShards}/150 toward a free egg</Text>
                </View>
              )}
              <View style={styles.shopGrid}>
                {BUILDINGS.map((b) => {
                  const st = buildings[b.id];
                  const active = selected === `build:${b.id}`;
                  const upCost = st ? b.upgradeCost(st.level) : null;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => (st ? undefined : onBuildSelect(b.id))}
                      style={[styles.shopCard, active && styles.shopCardActive]}
                    >
                      <BuildingIcon id={b.id} size={34} />
                      <Text style={styles.shopName} numberOfLines={1}>{b.name}</Text>
                      {!st ? (
                        <Text style={styles.shopPrice}>{active ? 'TAP TILE' : `✦ ${b.buildCost}`}</Text>
                      ) : (
                        <>
                          <Text style={styles.shopPrice}>Lv {st.level}</Text>
                          {upCost != null ? (
                            <Pressable
                              onPress={() => onUpgrade(b.id)}
                              disabled={busy || tokens < upCost}
                              style={[styles.refillBtn, (busy || tokens < upCost) && styles.refillBtnDisabled]}
                            >
                              <Text style={styles.refillBtnText}>Upgrade ({upCost})</Text>
                            </Pressable>
                          ) : (
                            <Text style={styles.fuelText}>MAX</Text>
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  title: { color: '#fff', fontFamily: 'Courier', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  exit: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  wallet: { color: '#ffd24d', fontFamily: 'Courier', fontSize: 14, marginBottom: 10 },
  error: { color: '#ff8aa3', fontFamily: 'Courier', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  board: {
    width: BOARD,
    height: BOARD,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: '#0d0620',
    overflow: 'hidden',
    position: 'relative',
  },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEditing: {
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  decorGlyph: { fontSize: CELL * 0.6, lineHeight: CELL },
  petLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 6,
  },
  petSlot: { margin: 2 },
  placedPet: {
    position: 'absolute',
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#7a4ed0',
    borderRadius: 8,
    paddingHorizontal: 30,
    paddingVertical: 12,
    marginTop: 14,
  },
  primaryBtnText: { color: '#fff', fontFamily: 'Courier', fontSize: 15, fontWeight: 'bold', letterSpacing: 2 },
  btnPressed: { opacity: 0.8 },
  editBar: { flexDirection: 'row', gap: 10, marginTop: 14 },
  saveBtn: { backgroundColor: '#7fee7f', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  eraseBtn: {
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#7a4ed0',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  eraseText: { color: '#d6c8ff', fontFamily: 'Courier', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  toolActive: { borderColor: '#ffd24d' },
  hint: {
    color: '#8a76c0',
    fontFamily: 'Courier',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 320,
    lineHeight: 16,
  },
  shopHeader: {
    color: '#bfa8f0',
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 8,
  },
  shopRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  shopCard: {
    width: 90,
    alignItems: 'center',
    backgroundColor: '#2a1a4a',
    borderWidth: 2,
    borderColor: '#3a2a5a',
    borderRadius: 8,
    paddingVertical: 8,
  },
  shopCardActive: { borderColor: '#ffd24d' },
  shopGlyph: { fontSize: 30, lineHeight: 38 },
  floorSwatch: { width: 36, height: 36, borderRadius: 6, marginVertical: 2 },
  shopName: { color: '#fff', fontFamily: 'Courier', fontSize: 12, marginTop: 2 },
  shopPrice: { color: '#ffd24d', fontFamily: 'Courier', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  fuelText: { color: '#cfe3ef', fontSize: 10, marginTop: 2 },
  shardsMeter: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  shardsEgg: { width: 14, height: 14 },
  refillBtn: {
    backgroundColor: '#3a7d4f',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 3,
  },
  refillBtnDisabled: { opacity: 0.5 },
  refillBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  readyBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ffd24d',
    borderRadius: 8,
    paddingHorizontal: 3,
    minWidth: 16,
    alignItems: 'center',
  },
  readyBadgeText: { fontSize: 11 },
});

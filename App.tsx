import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import { useAuth } from './src/state/useAuth';
import { usePet, EGG_COST } from './src/state/usePet';
import { isSupabaseConfigured } from './src/lib/supabase';
import { LoginScreen } from './src/components/LoginScreen';
import { HatchScreen } from './src/components/HatchScreen';
import { GameScreen } from './src/components/GameScreen';
import { BattleScreen } from './src/components/BattleScreen';
import { ImportScreen } from './src/components/ImportScreen';
import { LeaderboardScreen } from './src/components/LeaderboardScreen';
import { FriendsScreen } from './src/components/FriendsScreen';
import { DailyScreen } from './src/components/DailyScreen';
import { MarketplaceScreen } from './src/components/MarketplaceScreen';
import { StoreScreen } from './src/components/StoreScreen';
import { purchasesAvailable } from './src/state/purchases';
import { recordPvpResult } from './src/battle/pvp';

const SKY = '#1565ad';
const GRASS = '#12b35a';
const TOOTH = 18;
// Enough teeth to span an ultrawide viewport; the row is clipped to width.
const TEETH_COUNT = 200;

export default function App() {
  const { username, loaded: authLoaded, signUp, logIn, logOut } = useAuth();
  const {
    pets,
    activePet,
    tokens,
    loaded: petLoaded,
    hatch,
    switchPet,
    removePet,
    renamePet,
    trainStat,
    grantTokens,
    setWalletTokens,
    reloadCollection,
    importablePets,
    scanLocalPets,
    importLocalPets,
    skipImport,
    act,
  } = usePet(username);

  const [addingNew, setAddingNew] = useState(false);
  // null = game screen; 'pve'/'pvp' = battle; the rest are full-screen menus.
  const [view, setView] = useState<
    null | 'pve' | 'pvp' | 'leaderboard' | 'friends' | 'marketplace' | 'daily' | 'store'
  >(null);

  // Whenever the user changes (login/logout), reset transient overlays.
  useEffect(() => {
    setAddingNew(false);
    setView(null);
  }, [username]);

  // Returning from Stripe Checkout (?purchase=success): the webhook credits
  // tokens server-side, so re-pull the wallet (twice, to cover webhook lag).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const result = new URLSearchParams(window.location.search).get('purchase');
    if (!result) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (result === 'success') {
      reloadCollection();
      const t = setTimeout(() => reloadCollection(), 3500);
      return () => clearTimeout(t);
    }
  }, [reloadCollection]);

  const ready = authLoaded && (!username || petLoaded);

  const handleHatch = (name: string) => {
    hatch(name);
    setAddingNew(false);
  };

  const handleRemove = () => {
    if (activePet) removePet(activePet.id);
  };

  // Manual recovery of pets saved in this browser's local storage.
  const handleRestore = async () => {
    const n = await scanLocalPets();
    if (n === 0) {
      const msg = 'No saved pets were found in this browser.';
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        if (typeof window !== 'undefined') window.alert(msg);
      } else {
        Alert.alert('Restore pets', msg);
      }
    }
    // If pets were found, scanLocalPets set importablePets → ImportScreen shows.
  };
  const onRestore = isSupabaseConfigured ? handleRestore : undefined;

  let screen: React.ReactNode;
  if (!ready) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  } else if (!username) {
    screen = <LoginScreen onLogIn={logIn} onSignUp={signUp} />;
  } else if (importablePets && importablePets.length > 0 && !addingNew) {
    screen = (
      <ImportScreen
        username={username}
        pets={importablePets}
        onImport={importLocalPets}
        onSkip={skipImport}
      />
    );
  } else if ((pets.length === 0 || addingNew) && view !== 'marketplace') {
    screen = (
      <HatchScreen
        username={username}
        onHatch={handleHatch}
        onLogOut={logOut}
        tokens={tokens}
        cost={EGG_COST}
        onCancel={pets.length > 0 ? () => setAddingNew(false) : undefined}
        onRestore={pets.length === 0 ? onRestore : undefined}
        onMarketplace={isSupabaseConfigured ? () => setView('marketplace') : undefined}
      />
    );
  } else if (activePet && (view === 'pve' || view === 'pvp')) {
    screen = (
      <BattleScreen
        pet={activePet}
        mode={view}
        onReward={(amount) => grantTokens(amount)}
        onResult={view === 'pvp' ? recordPvpResult : undefined}
        onWalletChange={setWalletTokens}
        onExit={() => setView(null)}
      />
    );
  } else if (view === 'leaderboard' && username) {
    screen = <LeaderboardScreen username={username} onExit={() => setView(null)} />;
  } else if (view === 'friends' && username) {
    screen = <FriendsScreen onExit={() => setView(null)} />;
  } else if (view === 'daily' && username) {
    screen = <DailyScreen onWalletChange={setWalletTokens} onExit={() => setView(null)} />;
  } else if (view === 'store' && username) {
    screen = <StoreScreen tokens={tokens} onExit={() => setView(null)} />;
  } else if (view === 'marketplace' && username) {
    screen = (
      <MarketplaceScreen
        pets={pets}
        activeId={activePet ? activePet.id : null}
        tokens={tokens}
        username={username}
        onReload={reloadCollection}
        onExit={() => setView(null)}
      />
    );
  } else if (activePet) {
    screen = (
      <GameScreen
        pet={activePet}
        pets={pets}
        username={username}
        tokens={tokens}
        onAct={act}
        onSwitchPet={switchPet}
        onAddNew={() => setAddingNew(true)}
        onRemove={handleRemove}
        onRename={renamePet}
        onTrain={(stat) => trainStat(activePet.id, stat)}
        onBattle={() => setView('pve')}
        onPvp={isSupabaseConfigured ? () => setView('pvp') : undefined}
        onStore={purchasesAvailable() ? () => setView('store') : undefined}
        onDaily={isSupabaseConfigured ? () => setView('daily') : undefined}
        onLeaderboard={isSupabaseConfigured ? () => setView('leaderboard') : undefined}
        onFriends={isSupabaseConfigured ? () => setView('friends') : undefined}
        onMarketplace={isSupabaseConfigured ? () => setView('marketplace') : undefined}
        onRestore={onRestore}
        onLogOut={logOut}
      />
    );
  } else {
    // Edge case: pets exist but no active selected — shouldn't happen because
    // loadCollection always picks one, but fall back to the hatch screen.
    screen = (
      <HatchScreen
        username={username}
        onHatch={handleHatch}
        onLogOut={logOut}
        tokens={tokens}
        cost={EGG_COST}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.grass} pointerEvents="none">
        <View style={styles.teeth}>
          {Array.from({ length: TEETH_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[styles.tooth, i % 2 === 0 ? styles.toothUp : styles.toothGap]}
            />
          ))}
        </View>
        <View style={styles.grassBody} />
      </View>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>{screen}</SafeAreaView>
        <StatusBar style="light" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SKY,
    overflow: 'hidden',
  },
  grass: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
  },
  teeth: {
    flexDirection: 'row',
    height: TOOTH,
    overflow: 'hidden',
  },
  tooth: {
    width: TOOTH,
    height: TOOTH,
  },
  toothUp: {
    backgroundColor: GRASS,
  },
  toothGap: {
    backgroundColor: 'transparent',
  },
  grassBody: {
    flex: 1,
    backgroundColor: GRASS,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 13, 46, 0.55)',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

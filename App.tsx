import React, { useState, useEffect } from 'react';
import {
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  View,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from './src/state/useAuth';
import { usePet } from './src/state/usePet';
import { LoginScreen } from './src/components/LoginScreen';
import { HatchScreen } from './src/components/HatchScreen';
import { GameScreen } from './src/components/GameScreen';

export default function App() {
  const { username, loaded: authLoaded, signUp, logIn, logOut } = useAuth();
  const {
    pets,
    activePet,
    loaded: petLoaded,
    hatch,
    switchPet,
    removePet,
    act,
  } = usePet(username);

  const [addingNew, setAddingNew] = useState(false);

  // Whenever the user changes (login/logout), reset the "add new" overlay.
  useEffect(() => {
    setAddingNew(false);
  }, [username]);

  const ready = authLoaded && (!username || petLoaded);

  const handleHatch = (name: string) => {
    hatch(name);
    setAddingNew(false);
  };

  const handleRemove = () => {
    if (activePet) removePet(activePet.id);
  };

  let screen: React.ReactNode;
  if (!ready) {
    screen = (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  } else if (!username) {
    screen = <LoginScreen onLogIn={logIn} onSignUp={signUp} />;
  } else if (pets.length === 0 || addingNew) {
    screen = (
      <HatchScreen
        username={username}
        onHatch={handleHatch}
        onLogOut={logOut}
        onCancel={pets.length > 0 ? () => setAddingNew(false) : undefined}
      />
    );
  } else if (activePet) {
    screen = (
      <GameScreen
        pet={activePet}
        pets={pets}
        username={username}
        onAct={act}
        onSwitchPet={switchPet}
        onAddNew={() => setAddingNew(true)}
        onRemove={handleRemove}
        onLogOut={logOut}
      />
    );
  } else {
    // Edge case: pets exist but no active selected — shouldn't happen because
    // loadCollection always picks one, but fall back to the hatch screen.
    screen = (
      <HatchScreen username={username} onHatch={handleHatch} onLogOut={logOut} />
    );
  }

  return (
    <ImageBackground
      source={require('./assets/background-tall.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>{screen}</SafeAreaView>
        <StatusBar style="light" />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#1a0d2e',
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

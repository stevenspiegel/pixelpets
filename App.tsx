import React from 'react';
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
  const { pet, loaded: petLoaded, hatch, act, reset } = usePet(username);

  const ready = authLoaded && (!username || petLoaded);

  return (
    <ImageBackground
      source={require('./assets/background-tall.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>
          {!ready ? (
            <View style={styles.center}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : !username ? (
            <LoginScreen onLogIn={logIn} onSignUp={signUp} />
          ) : pet ? (
            <GameScreen
              pet={pet}
              username={username}
              onAct={act}
              onReset={reset}
              onLogOut={logOut}
            />
          ) : (
            <HatchScreen username={username} onHatch={hatch} onLogOut={logOut} />
          )}
        </SafeAreaView>
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

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
import { usePet } from './src/state/usePet';
import { HatchScreen } from './src/components/HatchScreen';
import { GameScreen } from './src/components/GameScreen';

export default function App() {
  const { pet, loaded, hatch, act, reset } = usePet();

  return (
    <ImageBackground
      source={require('./assets/background-tall.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>
          {!loaded ? (
            <View style={styles.center}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : pet ? (
            <GameScreen pet={pet} onAct={act} onReset={reset} />
          ) : (
            <HatchScreen onHatch={hatch} />
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

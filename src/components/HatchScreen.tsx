import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

type Props = {
  onHatch: (name: string) => void;
};

export const HatchScreen: React.FC<Props> = ({ onHatch }) => {
  const [name, setName] = useState('');
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <Image
        source={require('../../assets/header.png')}
        style={styles.header}
        resizeMode="contain"
      />
      <Text style={styles.title}>PIXEL PETS</Text>
      <Text style={styles.subtitle}>Hatch and grow your digital pet!</Text>
      <Image
        source={require('../../assets/egg.gif')}
        style={styles.egg}
        resizeMode="contain"
      />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name your pet"
        placeholderTextColor="#8a76c0"
        style={styles.input}
        maxLength={16}
        autoCapitalize="words"
      />
      <Pressable
        onPress={() => onHatch(name.trim() || 'Pixel')}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>GET AN EGG!</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    width: 280,
    height: 60,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 6,
    textShadowColor: '#7a4ed0',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  subtitle: {
    color: '#d6c8ff',
    fontFamily: 'Courier',
    fontSize: 14,
    marginBottom: 18,
  },
  egg: {
    width: 200,
    height: 200,
    marginBottom: 18,
  },
  input: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#2a1a4a',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Courier',
    marginBottom: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ff5470',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    backgroundColor: '#e23a5a',
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});

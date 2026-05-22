import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';

type Props = {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
};

export const ActionButton: React.FC<Props> = ({ label, icon, onPress, disabled }) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexBasis: '30%',
    flexGrow: 1,
    margin: 4,
    backgroundColor: '#3a2070',
    borderWidth: 3,
    borderColor: '#7a4ed0',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
  },
  buttonPressed: {
    backgroundColor: '#5a30a0',
    transform: [{ translateY: 2 }],
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  inner: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 26,
    marginBottom: 2,
  },
  label: {
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
});

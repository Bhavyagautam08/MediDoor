import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Keyboard } from 'react-native';

export default function OtpInput({ length = 6, value, onChangeText }) {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    // Sync external value with internal state
    if (value) {
      const chars = value.split('').slice(0, length);
      const newOtp = new Array(length).fill('');
      chars.forEach((c, i) => newOtp[i] = c);
      setOtp(newOtp);
    } else {
      setOtp(newOtp => new Array(length).fill(''));
    }
  }, [value, length]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    onChangeText(newOtp.join(''));

    // Move to next input if there is a value
    if (text && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
    
    // Dismiss keyboard if it's the last input
    if (text && index === length - 1) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  return (
    <View style={styles.container}>
      {otp.map((digit, index) => (
        <TextInput
          key={index}
          style={[styles.input, digit && styles.inputActive]}
          maxLength={1}
          keyboardType="default"
          autoCapitalize="characters"
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          value={digit}
          ref={(ref) => (inputRefs.current[index] = ref)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  input: {
    width: 42,
    height: 52,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  inputActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
});

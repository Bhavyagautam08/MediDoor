import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { ShieldCheck, X } from 'lucide-react-native';

export default function OtpModal({ visible, onClose, onSubmit }) {
  const [otp, setOtp] = useState('');

  const handleSubmit = () => {
    if (otp.length === 4) {
      onSubmit(otp);
      setOtp('');
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <KeyboardAvoidingView 
          style={styles.overlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.card}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X color="#6B7280" size={24} />
            </TouchableOpacity>

            <View style={styles.iconWrapper}>
              <ShieldCheck color="#10B981" size={32} />
            </View>

            <Text style={styles.title}>Secure Drop-off</Text>
            <Text style={styles.subtitle}>
              Ask the customer for their 4-digit PIN to confirm the delivery.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter PIN"
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              autoFocus={true}
              secureTextEntry={false}
            />

            <TouchableOpacity 
              style={[styles.submitBtn, otp.length === 4 ? styles.submitBtnActive : styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={otp.length !== 4}
            >
              <Text style={styles.submitText}>Verify & Deliver</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22
  },
  input: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 12,
    marginBottom: 24
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center'
  },
  submitBtnActive: {
    backgroundColor: '#10B981'
  },
  submitBtnDisabled: {
    backgroundColor: '#D1D5DB'
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

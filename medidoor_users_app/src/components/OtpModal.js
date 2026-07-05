import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from 'react-native';

export default function OtpModal({ visible, onClose, onSubmit }) {
  const [otp, setOtp] = useState('');

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Enter Drop-off PIN</Text>
          <Text style={styles.desc}>Ask the customer for their 6-digit or 4-digit PIN to confirm the delivery.</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter PIN"
            keyboardType="default"
            autoCapitalize="characters"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.submitBtn]} onPress={() => onSubmit(otp)}>
              <Text style={styles.submitText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#111827' },
  desc: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 20, textAlign: 'center', letterSpacing: 4, marginBottom: 20, color: '#111827' },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginLeft: 12 },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  submitBtn: { backgroundColor: '#10B981' },
  cancelText: { color: '#4B5563', fontWeight: 'bold' },
  submitText: { color: '#fff', fontWeight: 'bold' }
});

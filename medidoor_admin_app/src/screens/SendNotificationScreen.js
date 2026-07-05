import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { ChevronLeft, Send, Users, Truck, Store, CheckCircle } from 'lucide-react-native';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function SendNotificationScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('customers'); // 'customers', 'delivery_agents', 'pharmacies'
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please enter a title and message.');
      return;
    }

    setSending(true);
    try {
      // 1. Fetch all users in the selected audience
      const snapshot = await getDocs(collection(db, audience));
      
      if (snapshot.empty) {
        Alert.alert('Info', 'No users found in this audience.');
        setSending(false);
        return;
      }

      // 2. Write to each user's notifications subcollection
      const promises = [];
      snapshot.forEach((userDoc) => {
        const notifRef = doc(collection(db, audience, userDoc.id, 'notifications'));
        promises.push(
          setDoc(notifRef, {
            title: title.trim(),
            body: message.trim(),
            read: false,
            createdAt: serverTimestamp(),
            type: 'admin_broadcast'
          })
        );
      });

      await Promise.all(promises);
      
      Alert.alert('Success', `Notification sent to ${snapshot.size} users!`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error sending notifications:', error);
      Alert.alert('Error', 'Failed to send notifications.');
    }
    setSending(false);
  };

  const AudienceOption = ({ value, label, icon: Icon, color }) => {
    const isSelected = audience === value;
    return (
      <TouchableOpacity 
        style={[styles.audienceCard, isSelected && { borderColor: color, backgroundColor: `${color}10` }]}
        onPress={() => setAudience(value)}
      >
        <View style={[styles.iconContainer, { backgroundColor: isSelected ? color : '#F1F5F9' }]}>
          <Icon color={isSelected ? '#FFFFFF' : '#94A3B8'} size={20} />
        </View>
        <Text style={[styles.audienceLabel, isSelected && { color: color, fontWeight: '700' }]}>{label}</Text>
        {isSelected && <CheckCircle color={color} size={16} style={{ marginLeft: 'auto' }} />}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : null}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Broadcast Notification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Select Audience</Text>
        <View style={styles.audienceContainer}>
          <AudienceOption value="customers" label="Customers" icon={Users} color="#3B82F6" />
          <AudienceOption value="delivery_agents" label="Delivery Partners" icon={Truck} color="#F59E0B" />
          <AudienceOption value="pharmacies" label="Pharmacies" icon={Store} color="#8B5CF6" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notification Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Special Discount Inside!"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#94A3B8"
            maxLength={50}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Message Body</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Type your message here..."
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.sendBtn, sending && { opacity: 0.7 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Send color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.sendBtnText}>Broadcast Now</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  audienceContainer: {
    marginBottom: 24,
  },
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F1F5F9',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audienceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#0F172A',
  },
  textArea: {
    height: 120,
  },
  sendBtn: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  }
});

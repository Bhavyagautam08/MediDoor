import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XCircle, RefreshCw, Mail } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export default function RejectedScreen({ navigation }) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) { navigation.replace('Login'); return; }

    // Listen in case admin reverses the decision
    const unsubscribe = onSnapshot(doc(db, 'pharmacies', currentUser.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setRejectionReason(data.rejectionReason || 'No specific reason provided.');
      setPharmacyName(data.name || '');
      // If admin reverses and approves
      if (data.status === 'approved') navigation.replace('PharmacyRoot');
      if (data.status === 'pending') navigation.replace('UnderReview');
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigation.replace('RoleSelection');
  };

  const handleReapply = () => {
    Alert.alert(
      'Re-apply?',
      'This will log you out. You can then sign up again with a new account or corrected documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-apply', onPress: async () => {
            await auth.signOut();
            navigation.replace('SignUp', { role: 'Pharmacy Admin' });
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.headerBand} />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <XCircle color="#EF4444" size={52} />
        </View>

        <Text style={styles.title}>Application Rejected</Text>
        <Text style={styles.subtitle}>
          Unfortunately, your pharmacy partner application for{pharmacyName ? ` "${pharmacyName}"` : ''} was not approved at this time.
        </Text>

        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Reason from our team:</Text>
          <Text style={styles.reasonText}>{rejectionReason || 'Loading...'}</Text>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>What can you do?</Text>

          <TouchableOpacity style={styles.actionRow} onPress={handleReapply}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <RefreshCw color="#D97706" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Re-apply with corrected documents</Text>
              <Text style={styles.actionDesc}>Upload a clearer license and re-submit your application.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => Linking.openURL('mailto:support@axoro.in?subject=Pharmacy Application Rejected - Appeal')}>
            <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
              <Mail color="#3B82F6" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Contact support to appeal</Text>
              <Text style={styles.actionDesc}>Email support@axoro.in to discuss your application.</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBand: { height: 6 },
  content: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FECACA', marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  reasonCard: {
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, width: '100%',
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#EF4444',
  },
  reasonLabel: { fontSize: 12, fontWeight: 'bold', color: '#DC2626', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  actionsCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, width: '100%' },
  actionsTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  actionDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  footer: { padding: 24 },
  logoutButton: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  logoutButtonText: { color: '#374151', fontSize: 14, fontWeight: 'bold' },
});

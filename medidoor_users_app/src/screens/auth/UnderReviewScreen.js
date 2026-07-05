import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export default function UnderReviewScreen({ navigation }) {
  const [status, setStatus] = useState('pending');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigation.replace('Login');
      return;
    }

    // Real-time listener — auto-navigates when admin acts
    const unsubscribe = onSnapshot(
      doc(db, 'pharmacies', currentUser.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const newStatus = data.status;
        setStatus(newStatus);

        if (newStatus === 'approved') {
          navigation.replace('PharmacyRoot');
        } else if (newStatus === 'rejected') {
          setRejectionReason(data.rejectionReason || '');
          navigation.replace('Rejected');
        }
      },
      (err) => console.error('Status listener error:', err)
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigation.replace('RoleSelection');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.headerBand} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Clock color="#D97706" size={52} />
          </View>

          <Text style={styles.title}>Application Under Review</Text>
          <Text style={styles.subtitle}>
            Our team is verifying your pharmacy license and registration details.
            This typically takes 24–48 business hours.
          </Text>

          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>What happens next?</Text>

            <View style={styles.step}>
              <View style={[styles.stepDot, { backgroundColor: '#00C853' }]}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Application Received ✓</Text>
                <Text style={styles.stepDesc}>Your license has been submitted for review.</Text>
              </View>
            </View>

            <View style={styles.stepLine} />

            <View style={styles.step}>
              <View style={[styles.stepDot, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>License Verification (In Progress)</Text>
                <Text style={styles.stepDesc}>Our compliance team is reviewing your documents.</Text>
              </View>
            </View>

            <View style={styles.stepLine} />

            <View style={styles.step}>
              <View style={[styles.stepDot, { backgroundColor: '#E5E7EB' }]}>
                <Text style={[styles.stepNum, { color: '#9CA3AF' }]}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: '#9CA3AF' }]}>Account Activated</Text>
                <Text style={styles.stepDesc}>You'll be notified and automatically redirected.</Text>
              </View>
            </View>
          </View>

          <View style={styles.autoNote}>
            <CheckCircle2 color="#00C853" size={16} />
            <Text style={styles.autoNoteText}>
              This screen will automatically update — no need to refresh!
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.helpText}>Questions? Email us at <Text style={{ color: '#00C853', fontWeight: 'bold' }}>support@medidoor.com</Text></Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBand: { height: 6 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
  content: { alignItems: 'center', padding: 24, paddingTop: 40 },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FDE68A', marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },
  stepsCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 20, width: '100%', marginBottom: 20 },
  stepsTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  stepLine: { width: 2, height: 16, backgroundColor: '#E5E7EB', marginLeft: 16, marginBottom: 4 },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepNum: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  stepDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  autoNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, width: '100%' },
  autoNoteText: { fontSize: 12, color: '#065F46', marginLeft: 8, flex: 1, lineHeight: 18 },
  footer: { padding: 24, alignItems: 'center' },
  helpText: { fontSize: 13, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
  logoutButton: { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, borderWidth: 1, borderColor: '#FECACA' },
  logoutButtonText: { color: '#DC2626', fontSize: 14, fontWeight: 'bold' },
});

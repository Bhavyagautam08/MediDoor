import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ChevronLeft, Store, MapPin, Phone } from 'lucide-react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function DashboardPharmaciesScreen({ navigation }) {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pharmacies'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort so approved ones are first, then pending, then suspended
      list.sort((a, b) => {
        const statusMap = { 'approved': 1, 'pending': 2, 'suspended': 3 };
        const aStatus = statusMap[a.status] || 4;
        const bStatus = statusMap[b.status] || 4;
        return aStatus - bStatus;
      });
      setPharmacies(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Pharmacies</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <Store color="#8B5CF6" size={32} />
          </View>
          <Text style={styles.summaryAmount}>{pharmacies.length}</Text>
          <Text style={styles.summaryTitle}>Total Registered Pharmacies</Text>
        </View>

        <Text style={styles.sectionTitle}>Partner Network</Text>
        {pharmacies.map(pharm => (
          <TouchableOpacity 
            key={pharm.id} 
            style={styles.card}
            onPress={() => navigation.navigate('UserDetails', { userId: pharm.id, role: 'pharmacies' })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBg}>
                <Store color="#8B5CF6" size={20} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.pharmName}>{pharm.name || 'Unnamed'}</Text>
                <View style={[styles.statusBadge, pharm.status === 'approved' ? styles.statusApproved : pharm.status === 'suspended' ? styles.statusSuspended : styles.statusPending]}>
                  <Text style={[styles.statusText, pharm.status === 'approved' ? styles.textApproved : pharm.status === 'suspended' ? styles.textSuspended : styles.textPending]}>
                    {pharm.status || 'pending'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.infoRow}>
              <MapPin color="#64748B" size={14} />
              <Text style={styles.infoText} numberOfLines={1}>{pharm.address || 'No address'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Phone color="#64748B" size={14} />
              <Text style={styles.infoText}>{pharm.phone || 'No phone'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {pharmacies.length === 0 && <Text style={styles.emptyText}>No pharmacies registered yet.</Text>}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  body: { flex: 1, padding: 16 },
  summaryCard: { backgroundColor: '#8B5CF6', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 32, marginBottom: 12 },
  summaryAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold', marginBottom: 4 },
  summaryTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBg: { backgroundColor: '#F3E8FF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardHeaderText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pharmName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusApproved: { backgroundColor: '#D1FAE5' },
  textApproved: { color: '#059669', fontSize: 12, fontWeight: 'bold' },
  statusPending: { backgroundColor: '#FEF3C7' },
  textPending: { color: '#D97706', fontSize: 12, fontWeight: 'bold' },
  statusSuspended: { backgroundColor: '#FEE2E2' },
  textSuspended: { color: '#DC2626', fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  infoText: { color: '#64748B', fontSize: 14, marginLeft: 6, flex: 1 },
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 24 }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ChevronLeft, Users, Phone, Calendar } from 'lucide-react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function DashboardUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUsers(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#F59E0B" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Customers</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <Users color="#F59E0B" size={32} />
          </View>
          <Text style={styles.summaryAmount}>{users.length}</Text>
          <Text style={styles.summaryTitle}>Total Registered Customers</Text>
        </View>

        <Text style={styles.sectionTitle}>Customer List</Text>
        {users.map(user => (
          <TouchableOpacity 
            key={user.id} 
            style={styles.card}
            onPress={() => navigation.navigate('UserDetails', { userId: user.id, role: 'customers' })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconBg}>
                <Users color="#F59E0B" size={20} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.userName}>{user.name || 'Unnamed'}</Text>
                <Text style={styles.userId}>#{user.id.slice(-8).toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Phone color="#64748B" size={14} />
              <Text style={styles.infoText}>{user.phone || user.email || 'No contact provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Calendar color="#64748B" size={14} />
              <Text style={styles.infoText}>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {users.length === 0 && <Text style={styles.emptyText}>No customers registered yet.</Text>}
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
  summaryCard: { backgroundColor: '#F59E0B', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 32, marginBottom: 12 },
  summaryAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold', marginBottom: 4 },
  summaryTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBg: { backgroundColor: '#FEF3C7', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardHeaderText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', flex: 1 },
  userId: { fontSize: 12, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  infoText: { color: '#64748B', fontSize: 14, marginLeft: 6 },
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 24 }
});

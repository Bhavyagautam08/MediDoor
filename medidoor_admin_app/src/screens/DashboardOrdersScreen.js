import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ChevronLeft, ShoppingBag, Clock } from 'lucide-react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function DashboardOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const active = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'cancelled' && data.status !== 'cancel' && data.status !== 'delivered') {
          active.push({ id: doc.id, ...data });
        }
      });
      active.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(active);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Active Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <ShoppingBag color="#3B82F6" size={32} />
          </View>
          <Text style={styles.summaryAmount}>{orders.length}</Text>
          <Text style={styles.summaryTitle}>Orders currently in progress</Text>
        </View>

        <Text style={styles.sectionTitle}>Order Queue</Text>
        {orders.map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{order.status}</Text>
              </View>
            </View>
            <View style={styles.orderBody}>
              <View style={styles.infoRow}>
                <Clock color="#64748B" size={14} />
                <Text style={styles.infoText}>{new Date(order.createdAt).toLocaleTimeString()}</Text>
              </View>
              <Text style={styles.orderAmount}>₹{order.totalAmount}</Text>
            </View>
          </View>
        ))}
        {orders.length === 0 && <Text style={styles.emptyText}>No active orders right now.</Text>}
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
  summaryCard: { backgroundColor: '#3B82F6', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 32, marginBottom: 12 },
  summaryAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold', marginBottom: 4 },
  summaryTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  orderCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  statusBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold', textTransform: 'capitalize' },
  orderBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { color: '#64748B', fontSize: 14, marginLeft: 6 },
  orderAmount: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 24 }
});

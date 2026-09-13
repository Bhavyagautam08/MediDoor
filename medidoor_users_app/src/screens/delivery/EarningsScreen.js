import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Platform, ActivityIndicator, Alert, TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Package, Star, Clock } from 'lucide-react-native';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { calculateDistance } from '../../utils/distance';

const getEarning = (order) => {
  if (order.pharmacyLocation && order.customerLocation) {
    const dist = calculateDistance(order.pharmacyLocation, order.customerLocation);
    return Math.max(30, Math.floor(20 + (dist * 10)));
  }
  return order.deliveryFee ? Math.max(30, Math.floor(order.deliveryFee * 0.8)) : 40;
};
export default function EarningsScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riderProfile, setRiderProfile] = useState(null);

  const handleWithdraw = () => {
    Alert.alert(
      'Request Payout',
      'Please confirm you want to withdraw your available balance to your linked bank account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Withdraw',
          style: 'default',
          onPress: () => Alert.alert('Success', 'Your payout request has been initiated. Funds will reflect in 1-2 business days.')
        }
      ]
    );
  };

  const handleDepositCash = () => {
    const cash = riderProfile?.floatingCash || 0;
    if (cash === 0) {
      Alert.alert('No Dues', 'You have no floating cash to deposit.');
      return;
    }
    
    Alert.alert(
      'Deposit Cash',
      `You are holding ₹${cash} in COD collections. Do you want to pay this to the admin now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay via UPI',
          style: 'default',
          onPress: async () => {
            try {
              if (auth.currentUser) {
                await updateDoc(doc(db, 'delivery_agents', auth.currentUser.uid), {
                  floatingCash: 0
                });
                Alert.alert('Payment Successful', 'Floating cash deposited successfully. Your limit is cleared!');
              }
            } catch (error) {
              Alert.alert('Error', 'Payment failed.');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) { setLoading(false); return; }

    const q = query(
      collection(db, 'orders'),
      where('riderId', '==', currentUser.uid),
      where('status', '==', 'Delivered')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      // Sort newest first
      data.sort((a, b) => (b.deliveredAt || b.createdAt || 0) - (a.deliveredAt || a.createdAt || 0));
      setDeliveries(data);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('Earnings orders snapshot error:', err);
    });

    const profileUnsub = onSnapshot(doc(db, 'delivery_agents', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setRiderProfile(docSnap.data());
      }
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('Earnings profile snapshot error:', err);
    });

    return () => {
      unsubscribe();
      profileUnsub();
    };
  }, []);

  // Time-based grouping
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;

  const todayDeliveries = deliveries.filter(d => (d.deliveredAt || d.createdAt || 0) >= todayStart);
  const weekDeliveries = deliveries.filter(d => (d.deliveredAt || d.createdAt || 0) >= weekStart);
  const totalDeliveries = deliveries.length;

  const todayEarnings = todayDeliveries.reduce((sum, d) => sum + getEarning(d), 0);
  const weekEarnings = weekDeliveries.reduce((sum, d) => sum + getEarning(d), 0);
  const totalEarnings = deliveries.reduce((sum, d) => sum + getEarning(d), 0);

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF9800" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero */}
        <LinearGradient colors={['#FF9800', '#E65100']} style={styles.hero}>
          <Text style={styles.heroLabel}>Available Balance</Text>
          <Text style={styles.heroValue}>₹{totalEarnings.toLocaleString()}</Text>
          <Text style={styles.heroSub}>{totalDeliveries} lifetime deliveries completed</Text>

          <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw}>
            <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
          </TouchableOpacity>

          {(riderProfile?.floatingCash || 0) > 0 && (
            <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, marginBottom: 24, width: '100%', elevation: 4 }}>
              <Text style={{ color: '#991B1B', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>Floating Cash: ₹{riderProfile.floatingCash}</Text>
              <Text style={{ color: '#7F1D1D', fontSize: 12, marginBottom: 12 }}>You are holding COD cash. If this exceeds ₹2,000, your account will be blocked from receiving orders.</Text>
              <TouchableOpacity style={{ backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }} onPress={handleDepositCash}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Deposit Cash (Pay Admin)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Period Cards */}
          <View style={styles.periodRow}>
            <View style={styles.periodCard}>
              <Text style={styles.periodValue}>₹{todayEarnings}</Text>
              <Text style={styles.periodLabel}>Today</Text>
              <Text style={styles.periodCount}>{todayDeliveries.length} deliveries</Text>
            </View>
            <View style={styles.periodDivider} />
            <View style={styles.periodCard}>
              <Text style={styles.periodValue}>₹{weekEarnings}</Text>
              <Text style={styles.periodLabel}>This Week</Text>
              <Text style={styles.periodCount}>{weekDeliveries.length} deliveries</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { icon: Package, label: 'Total Orders', value: totalDeliveries, color: '#FF9800' },
            { icon: TrendingUp, label: 'Avg per Trip', value: `₹${totalDeliveries > 0 ? Math.round(totalEarnings / totalDeliveries) : 0}`, color: '#10B981' },
            { icon: Star, label: 'Rating', value: '4.9 ★', color: '#F59E0B' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <View key={stat.label} style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: stat.color + '20' }]}>
                  <Icon color={stat.color} size={20} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Delivery History */}
        <Text style={styles.sectionTitle}>Delivery History</Text>
        <View style={styles.historyCard}>
          {deliveries.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Package color="#D1D5DB" size={60} />
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptySubtitle}>Your completed deliveries and earnings will show here.</Text>
            </View>
          ) : (
            deliveries.map((delivery, i) => (
              <View key={delivery.id} style={[styles.deliveryRow, i < deliveries.length - 1 && styles.rowBorder]}>
                <View style={styles.deliveryIconBox}>
                  <Package color="#FF9800" size={18} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.deliveryId}>#{delivery.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.deliveryAddress} numberOfLines={1}>{delivery.address}</Text>
                  <View style={styles.deliveryMeta}>
                    <Clock color="#9CA3AF" size={11} />
                    <Text style={styles.deliveryTime}> {formatDate(delivery.deliveredAt || delivery.createdAt)}</Text>
                  </View>
                </View>
                <View style={styles.deliveryEarning}>
                  <Text style={styles.earningAmount}>+₹{getEarning(delivery)}</Text>
                  <View style={styles.deliveredBadge}>
                    <Text style={styles.deliveredBadgeText}>Done</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { paddingTop: Platform.OS === 'android' ? 44 : 24, paddingBottom: 36, paddingHorizontal: 20, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  heroValue: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, marginBottom: 16 },
  withdrawBtn: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  withdrawBtnText: { color: '#E65100', fontSize: 16, fontWeight: 'bold' },
  periodRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, width: '100%', overflow: 'hidden' },
  periodCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  periodDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  periodValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  periodLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' },
  periodCount: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '500', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginHorizontal: 16, marginBottom: 12 },
  historyCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, elevation: 1 },
  emptyHistory: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  deliveryIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  deliveryId: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  deliveryAddress: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  deliveryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  deliveryTime: { fontSize: 11, color: '#9CA3AF' },
  deliveryEarning: { alignItems: 'flex-end' },
  earningAmount: { fontSize: 16, fontWeight: 'bold', color: '#10B981' },
  deliveredBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  deliveredBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#065F46' },
});

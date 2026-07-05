import React, { useState, useEffect } from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { Package, CheckCircle2, Clock, Truck, House, Navigation } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

const STATUS_STEPS = ['Placed', 'Accepted', 'Ready for Pickup', 'Out for Delivery', 'Delivered'];

const STATUS_COLORS = {
  'Placed':                 { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Verifying Prescription': { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  'Accepted':               { bg: '#F3E8FF', text: '#6D28D9', dot: '#8B5CF6' },
  'Ready for Pickup':       { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  'Driver Assigned':        { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  'Picked Up':              { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  'Out for Delivery':       { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  'Delivered':              { bg: '#D1FAE5', text: '#065F46', dot: '#00C853' },
  'Cancelled':              { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};

export default function OrderTrackingScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = [];
      snapshot.forEach(doc => fetchedOrders.push({ id: doc.id, ...doc.data() }));
      // Sort client-side by createdAt descending (avoids Firestore composite index requirement)
      fetchedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(fetchedOrders);
      setLoading(false);
    }, (err) => {
      console.error('OrderTracking error:', err); Alert.alert("Error", `OrderTracking error: ${err?.message || err || "An unexpected error occurred"}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStepsDone = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('deliver') && !s.includes('out')) return 5;
    if (s.includes('out') || s.includes('pick') || s.includes('way')) return 4;
    if (s.includes('ready') || s.includes('assign')) return 3;
    if (s.includes('accept') || s.includes('prepar') || s.includes('verify')) return 2;
    return 1;
  };

  const renderTimeline = (status) => {
    const stepsDone = getStepsDone(status);
    const icons = [Package, CheckCircle2, Truck, Navigation, House];
    const labels = ['Placed', 'Accepted', 'Ready', 'On the Way', 'Delivered'];

    return (
      <View style={styles.timelineRow}>
        {labels.map((label, i) => {
          const done = i < stepsDone;
          const Icon = icons[i];
          return (
            <View key={label} style={styles.timelineStep}>
              <View style={[styles.timelineCircle, done && styles.timelineCircleDone]}>
                <Icon size={11} color={done ? '#fff' : '#9CA3AF'} />
              </View>
              {i < labels.length - 1 && (
                <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
              )}
              <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]} numberOfLines={2}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Package color="#D1D5DB" size={80} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>Your orders will appear here after you place one.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const badge = STATUS_COLORS[item.status] || STATUS_COLORS['Placed'];
            const isTrackable = ['Driver Assigned', 'Picked Up', 'Out for Delivery'].includes(item.status);

            return (
              <View style={styles.orderCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>#{item.numericId || item.id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: badge.dot }]} />
                    <Text style={[styles.statusText, { color: badge.text }]}>{item.status}</Text>
                  </View>
                </View>

                {/* Items summary */}
                <View style={{ marginBottom: 12 }}>
                  {item.items?.map((i, idx) => (
                    <Text key={idx} style={styles.itemSummaryRow}>
                      {i.qty}x {i.name} (₹{(Number(i.price || 0) * Number(i.qty || 1)).toFixed(2)})
                    </Text>
                  )) || <Text style={styles.itemSummaryRow}>Order Items</Text>}
                </View>

                {/* Bill Breakdown */}
                <View style={styles.billBreakdown}>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Medicine Cost</Text><Text style={styles.billValue}>₹{Number(item.subtotal || 0).toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Delivery Charge</Text><Text style={styles.billValue}>₹{Number(item.deliveryFee || 0).toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billLabel}>Service Fee</Text><Text style={styles.billValue}>₹{Number(item.serviceFee || 15).toFixed(2)}</Text></View>
                </View>

                {/* Timeline */}
                {item.status !== 'Cancelled' && renderTimeline(item.status)}

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>₹{item.totalAmount?.toFixed(2)}</Text>
                  </View>
                  {isTrackable ? (
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => navigation.navigate('LiveTracking', { orderId: item.id })}
                    >
                      <Navigation size={16} color="#fff" />
                      <Text style={styles.trackBtnText}> Track Live</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.trackBtn, { backgroundColor: '#E5E7EB' }]}> 
                      <Text style={[styles.trackBtnText, { color: '#6B7280' }]}>No Active Tracking</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  list: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#374151', marginTop: 20 },
  emptySubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  orderDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  itemSummaryRow: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  billBreakdown: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billLabel: { fontSize: 12, color: '#6B7280' },
  billValue: { fontSize: 12, color: '#374151', fontWeight: '500' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  timelineStep: { flex: 1, alignItems: 'center', position: 'relative' },
  timelineCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center',
  },
  timelineCircleDone: { backgroundColor: '#00C853' },
  timelineLine: {
    position: 'absolute', top: 14, left: '50%', right: '-50%',
    height: 2, backgroundColor: '#E5E7EB', zIndex: -1,
  },
  timelineLineDone: { backgroundColor: '#00C853' },
  timelineLabel: { fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
  timelineLabelDone: { color: '#059669', fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 12, color: '#9CA3AF' },
  totalAmount: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  trackBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  trackBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});

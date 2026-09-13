import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Image, Alert, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, TrendingUp, Clock, CheckCircle2, XCircle, Package, ChevronRight, ClipboardList, Search } from 'lucide-react-native';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function DashboardScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pharmacyName, setPharmacyName] = useState('Partner');
  const [pharmacyRating, setPharmacyRating] = useState('New');
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    
    // Fetch pharmacy name
    const fetchName = async () => {
      const snap = await getDoc(doc(db, 'pharmacies', u.uid));
      if (snap.exists()) {
        const data = snap.data();
        setPharmacyName(data.name || 'Partner');
        setPharmacyRating(data.rating ? parseFloat(data.rating).toFixed(1) : 'New');
      }
    };
    fetchName();

    // Listen for unread notifications
    const notifQ = query(
      collection(db, 'pharmacies', u.uid, 'notifications'),
      where('read', '==', false)
    );
    const notifUnsubscribe = onSnapshot(notifQ, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    // Live listener for all orders
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Filter locally to avoid requiring complex Firestore indexes for now
        if (data.pharmacyId === u.uid) {
          fetched.push({ id: d.id, ...data });
        }
      });
      setOrders(fetched);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      notifUnsubscribe();
    };
  }, []);

  // Stats
  const totalOrders = orders.length;
  const pending = orders.filter(o => o.status === 'Placed').length;
  const readyForPickup = orders.filter(o => o.status === 'Ready for Pickup').length;
  const completed = orders.filter(o => o.status === 'Delivered').length;
  const cancelled = orders.filter(o => o.status === 'Cancelled').length;

  // Revenue
  const validOrders = orders.filter(o => !['Cancelled', 'Placed'].includes(o.status));
  const gross = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const platformFee = gross * 0.03;
  const net = gross - platformFee;

  // Recent orders (last 5)
  const recentOrders = orders
    .slice(0, 10)
    .filter(o => {
      if (!searchQuery) return true;
      const lowerQ = searchQuery.toLowerCase();
      const idMatch = o.id.toLowerCase().includes(lowerQ);
      const numericIdMatch = o.numericId?.toLowerCase().includes(lowerQ);
      const itemsMatch = o.items?.some(item => item.name.toLowerCase().includes(lowerQ));
      return idMatch || numericIdMatch || itemsMatch;
    });

  const STATUS_COLOR = {
    'Placed': { bg: '#FEF3C7', text: '#92400E' },
    'Verifying Prescription': { bg: '#EFF6FF', text: '#1D4ED8' },
    'Accepted': { bg: '#F3E8FF', text: '#6D28D9' },
    'Ready for Pickup': { bg: '#D1FAE5', text: '#065F46' },
    'Out for Delivery': { bg: '#DBEAFE', text: '#1E40AF' },
    'Delivered': { bg: '#D1FAE5', text: '#065F46' },
    'Cancelled': { bg: '#FEE2E2', text: '#991B1B' },
  };

  // Weekly Chart Calculation
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { 
      day: d.toLocaleDateString('en-US', { weekday: 'short' }), 
      dateStr: d.toDateString(),
      earnings: 0 
    };
  });

  validOrders.forEach(o => {
    const d = new Date(o.createdAt);
    const dateStr = d.toDateString();
    const dayObj = last7Days.find(day => day.dateStr === dateStr);
    if (dayObj) {
      dayObj.earnings += (o.totalAmount || 0) * 0.97; // Net earnings
    }
  });

  const maxWeeklyEarning = Math.max(...last7Days.map(d => d.earnings), 1); // Avoid div by 0

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero Header */}
        <LinearGradient colors={['#0D9494', '#00701A']} style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroGreet}>Welcome back,</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.heroName}>{pharmacyName}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 12, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>★ {pharmacyRating}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Orders')}>
                <ClipboardList color="#fff" size={20} />
                {pending > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{pending}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
                <Bell color="#fff" size={20} />
                {unreadCount > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unreadCount}</Text></View>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Revenue Card */}
          <View style={styles.revenueCard}>
            <View>
              <Text style={styles.revenueLabel}>Net Earnings (All Time)</Text>
              {loading
                ? <ActivityIndicator color="#0D9494" />
                : <Text style={styles.revenueValue}>₹{net.toFixed(2)}</Text>
              }
              <Text style={styles.revenueSub}>After 3% platform fee deducted</Text>
            </View>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => {
              if (net <= 0) {
                Alert.alert("No Funds", "You don't have any funds available to withdraw yet.");
                return;
              }
              Alert.alert(
                "Withdrawal Request Sent!", 
                `₹${net.toFixed(2)} will be transferred to your registered bank account within 2-3 business days.`
              );
            }}>
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Orders', value: totalOrders, icon: Package, color: '#0D9494' },
            { label: 'New Orders', value: pending, icon: Clock, color: '#F59E0B' },
            { label: 'Ready Pickup', value: readyForPickup, icon: CheckCircle2, color: '#3B82F6' },
            { label: 'Delivered', value: completed, icon: TrendingUp, color: '#8B5CF6' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <View key={stat.label} style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: stat.color + '20' }]}>
                  <Icon color={stat.color} size={22} />
                </View>
                <Text style={styles.statValue}>{loading ? '—' : stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Quick Action */}
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Orders')}>
          <View style={styles.quickActionLeft}>
            <View style={styles.quickActionIcon}>
              <Package color="#0D9494" size={22} />
            </View>
            <View>
              <Text style={styles.quickActionTitle}>Manage Incoming Orders</Text>
              <Text style={styles.quickActionSub}>{pending} new order{pending !== 1 ? 's' : ''} need attention</Text>
            </View>
          </View>
          <ChevronRight color="#9CA3AF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Inventory')}>
          <View style={styles.quickActionLeft}>
            <View style={styles.quickActionIcon}>
              <TrendingUp color="#8B5CF6" size={22} />
            </View>
            <View>
              <Text style={styles.quickActionTitle}>Manage Inventory</Text>
              <Text style={styles.quickActionSub}>Add, edit and track your stock</Text>
            </View>
          </View>
          <ChevronRight color="#9CA3AF" size={20} />
        </TouchableOpacity>

        {/* Weekly Chart */}
        <Text style={styles.sectionTitle}>Weekly Earnings</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartContainer}>
            {last7Days.map((day, idx) => {
              const heightPercent = (day.earnings / maxWeeklyEarning) * 100;
              return (
                <View key={idx} style={styles.barCol}>
                  <Text style={styles.barValue}>{day.earnings > 0 ? `₹${Math.round(day.earnings)}` : ''}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                  </View>
                  <Text style={styles.barDay}>{day.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Revenue Breakdown */}
        <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Gross Revenue</Text>
            <Text style={styles.breakdownValue}>₹{gross.toFixed(2)}</Text>
          </View>
          <View style={[styles.breakdownRow, styles.breakdownBorder]}>
            <Text style={styles.breakdownLabel}>Platform Fee (3%)</Text>
            <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>- ₹{platformFee.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: '#111827', fontWeight: 'bold', fontSize: 16 }]}>Net to Pharmacy</Text>
            <Text style={[styles.breakdownValue, { color: '#0D9494', fontWeight: 'bold', fontSize: 18 }]}>₹{net.toFixed(2)}</Text>
          </View>
        </View>

        {/* Recent Orders */}
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <View style={styles.searchContainer}>
          <Search color="#9CA3AF" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recent orders by ID or item..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.recentCard}>
          {loading ? (
            <ActivityIndicator color="#0D9494" />
          ) : recentOrders.length === 0 ? (
            <Text style={styles.noOrdersText}>No orders yet. They'll appear here once customers place them.</Text>
          ) : (
            recentOrders.map((o, i) => {
              const badge = STATUS_COLOR[o.status] || { bg: '#F3F4F6', text: '#374151' };
              return (
                <TouchableOpacity 
                  key={o.id} 
                  style={[styles.recentRow, i < recentOrders.length - 1 && styles.recentBorder]}
                  onPress={() => setSelectedOrderDetails(o)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentId}>#{o.numericId || o.id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.recentItems} numberOfLines={1}>
                      {o.items?.map(i => i.name).join(', ') || 'Items'}
                    </Text>
                  </View>
                  <View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusText, { color: badge.text }]}>{o.status}</Text>
                    </View>
                    <Text style={styles.recentAmount}>₹{o.totalAmount?.toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* Order Detail Modal */}
      <Modal visible={!!selectedOrderDetails} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrderDetails(null)}>
                <XCircle color="#EF4444" size={28} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}>#{selectedOrderDetails?.numericId || selectedOrderDetails?.id?.slice(-6).toUpperCase()}</Text>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>{selectedOrderDetails?.status || 'N/A'}</Text>
              
              {selectedOrderDetails?.address ? (
                <>
                  <Text style={styles.detailLabel}>Delivery Address</Text>
                  <Text style={styles.detailValue}>{selectedOrderDetails.address}</Text>
                </>
              ) : null}
              
              {selectedOrderDetails?.customerName ? (
                <>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>{selectedOrderDetails.customerName}</Text>
                </>
              ) : null}

              {selectedOrderDetails?.customerPhone ? (
                <>
                  <Text style={styles.detailLabel}>Customer Phone</Text>
                  <Text style={styles.detailValue}>{selectedOrderDetails.customerPhone}</Text>
                </>
              ) : null}

              <Text style={styles.detailLabel}>Billing</Text>
              <View style={styles.billingCard}>
                {(selectedOrderDetails?.items || []).map((item, idx) => (
                  <View key={idx} style={styles.billingRow}>
                    <Text style={styles.billingItem}>{item.qty} x {item.name}</Text>
                    <Text style={styles.billingAmount}>₹{(item.price * item.qty).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={styles.billingRow}>
                  <Text style={styles.billingItem}>Subtotal</Text>
                  <Text style={styles.billingAmount}>₹{(selectedOrderDetails?.subtotal || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingItem}>Delivery Fee</Text>
                  <Text style={styles.billingAmount}>₹{(selectedOrderDetails?.deliveryFee || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.billingRow}>
                  <Text style={styles.billingItem}>Service Fee</Text>
                  <Text style={styles.billingAmount}>₹{(selectedOrderDetails?.serviceFee || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.billingRow, { marginTop: 8 }]}> 
                  <Text style={[styles.billingItem, { fontWeight: 'bold' }]}>Total</Text>
                  <Text style={[styles.billingAmount, { fontWeight: 'bold' }]}>₹{(selectedOrderDetails?.totalAmount || 0).toFixed(2)}</Text>
                </View>
              </View>

              <Text style={styles.detailLabel}>Ratings</Text>
              <View style={styles.ratingDetailRow}>
                <Text style={styles.ratingDetailLabel}>Pharmacy Rating</Text>
                <Text style={styles.ratingDetailValue}>{typeof selectedOrderDetails?.serviceRating === 'number' ? selectedOrderDetails.serviceRating.toFixed(1) : 'N/A'}</Text>
              </View>

              {selectedOrderDetails?.reviewText ? (
                <>
                  <Text style={styles.detailLabel}>Customer Review</Text>
                  <Text style={styles.detailValue}>{selectedOrderDetails.reviewText}</Text>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  hero: { paddingTop: Platform.OS === 'android' ? 44 : 20, paddingBottom: 80, paddingHorizontal: 20 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  heroGreet: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  heroName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 2 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  bellBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  bellBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  revenueCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 },
  revenueLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  revenueValue: { fontSize: 34, fontWeight: 'bold', color: '#111827' },
  revenueSub: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  withdrawBtn: { backgroundColor: '#ECFDF5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  withdrawText: { color: '#065F46', fontWeight: 'bold', fontSize: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, marginTop: -44, gap: 8 },
  statCard: { width: '47.5%', backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, alignItems: 'flex-start' },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '500' },
  quickAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3 },
  quickActionLeft: { flexDirection: 'row', alignItems: 'center' },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  quickActionTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  quickActionSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  breakdownCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 20, marginBottom: 8, elevation: 1 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  breakdownBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  breakdownLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  recentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 24, marginHorizontal: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', marginHorizontal: 16 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  recentBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  recentId: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  recentItems: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-end' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  recentAmount: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginTop: 4, textAlign: 'right' },
  noOrdersText: { textAlign: 'center', color: '#6B7280', marginVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  detailContent: { paddingBottom: 24 },
  detailLabel: { fontSize: 12, color: '#6B7280', marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 'bold' },
  detailValue: { fontSize: 16, color: '#111827', marginTop: 4, fontWeight: '500' },
  billingCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billingItem: { fontSize: 14, color: '#4B5563', flex: 1 },
  billingAmount: { fontSize: 14, color: '#111827', fontWeight: '600' },
  ratingDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  ratingDetailLabel: { fontSize: 14, color: '#4B5563' },
  ratingDetailValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  chartCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, paddingBottom: 10, elevation: 1 },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 150 },
  barCol: { alignItems: 'center', width: '13%' },
  barValue: { fontSize: 9, color: '#6B7280', marginBottom: 4, fontWeight: 'bold' },
  barBg: { height: 100, width: 12, backgroundColor: '#F3F4F6', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { backgroundColor: '#0D9494', width: '100%', borderRadius: 6 },
  barDay: { fontSize: 11, color: '#6B7280', marginTop: 8, fontWeight: '500' },
});

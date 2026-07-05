import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Platform, ActivityIndicator, Alert, Modal, Image, TextInput
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, Clock, CheckCircle, XCircle, Package, Eye, ChevronRight, AlertTriangle, ShieldCheck, Search } from 'lucide-react-native';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

// Full status pipeline for pharmacy
const PHARMACY_TABS = [
  { key: 'Placed', label: 'New', color: '#F59E0B' },
  { key: 'Verifying Prescription', label: 'Verify Rx', color: '#3B82F6' },
  { key: 'Accepted', label: 'Preparing', color: '#8B5CF6' },
  { key: 'Ready for Pickup', label: 'Ready', color: '#10B981' },
  { key: 'History', label: 'History', color: '#6B7280' },
];

export default function OrderManagementScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Placed');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingRx, setViewingRx] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [otpInputs, setOtpInputs] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const webViewRef = React.useRef(null);
  
  const SLA_MINUTES = 3;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const knownOrderIds = React.useRef(new Set());

  // Audio Alerts for New Orders
  useEffect(() => {
    const manageAudio = async () => {
      const newPlacedOrders = orders.filter(o => o.status === 'Placed');
      let hasNewOrder = false;

      newPlacedOrders.forEach(order => {
        if (!knownOrderIds.current.has(order.id)) {
          hasNewOrder = true;
          knownOrderIds.current.add(order.id);
        }
      });

      if (hasNewOrder) {
        Alert.alert('New Order Received!', 'You have a new prescription or item order.');
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              var audio = document.getElementById('audio');
              if (audio) {
                audio.play();
                setTimeout(function() { audio.pause(); audio.currentTime = 0; }, 10000);
              }
            })();
            true;
          `);
        }
      }
    };
    manageAudio();
  }, [orders]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Filter locally
        if (data.pharmacyId === u.uid) {
          fetchedOrders.push({ id: d.id, ...data });
        }
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error('Order listener error:', error); Alert.alert("Error", `Order listener error: ${error?.message || error || "An unexpected error occurred"}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus, extraData = {}) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus, ...extraData });
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status. Please try again.');
    }
  };

  const getRemainingTimeMs = (createdAt) => {
    if (!createdAt) return 0;
    // Assuming createdAt is ISO string
    const elapsed = Date.now() - new Date(createdAt).getTime();
    const remaining = (SLA_MINUTES * 60 * 1000) - elapsed;
    return Math.max(0, remaining);
  };

  const formatRemaining = (ms) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // SLA Auto-Reject Watcher
  useEffect(() => {
    const placedOrders = orders.filter(o => o.status === 'Placed');
    placedOrders.forEach(o => {
      if (getRemainingTimeMs(o.createdAt) <= 0) {
        handleUpdateStatus(o.id, 'Cancelled');
      }
    });
  }, [now, orders]);

  const handleRemoveItem = async (order, itemIndex) => {
    const newItems = [...order.items];
    newItems.splice(itemIndex, 1);
    
    if (newItems.length === 0) {
       handleUpdateStatus(order.id, 'Cancelled');
       return;
    }
    const newSubtotal = newItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const newTax = newSubtotal * 0.05;
    const newTotal = newSubtotal + newTax + (order.deliveryFee || 0);

    try {
      await updateDoc(doc(db, 'orders', order.id), {
         items: newItems, subtotal: newSubtotal, taxes: newTax, totalAmount: newTotal
      });
    } catch(e) { Alert.alert("Error", "Could not remove item."); }
  };

  const handleVerifyOtp = (order) => {
    const inputOtp = otpInputs[order.id];
    const expectedOtp = order.pickupOtp || (order.numericId || order.id).slice(-4).toUpperCase(); // Fallback to mock OTP if not generated
    if (inputOtp === expectedOtp) {
      handleUpdateStatus(order.id, 'Picked Up');
      Alert.alert("Success", "Package safely handed over to Delivery Agent!");
    } else {
      Alert.alert("Invalid OTP", "Please check the 6-digit PIN from the Delivery Agent.");
    }
  };

  const filteredOrders = orders.filter(o => {
    let matchesTab = false;
    if (activeTab === 'History') {
       matchesTab = (o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'Picked Up');
    } else if (activeTab === 'Ready for Pickup') {
       matchesTab = (o.status === 'Ready for Pickup' || o.status === 'Driver Assigned');
    } else {
       matchesTab = (o.status === activeTab);
    }
    
    if (!searchQuery) return matchesTab;
    const lowerQ = searchQuery.toLowerCase();
    const orderId = (o.numericId || o.id.slice(-6).toUpperCase()).toLowerCase();
    return matchesTab && orderId.includes(lowerQ);
  });

  const getElapsedTime = (ts) => {
    if (!ts) return 'Just now';
    const timeMs = new Date(ts).getTime();
    if (isNaN(timeMs)) return 'Just now';
    const mins = Math.floor((Date.now() - timeMs) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  // Badge counts for tabs
  const getBadge = (key) => {
    if (key === 'History') return orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'Picked Up').length;
    if (key === 'Ready for Pickup') return orders.filter(o => o.status === 'Ready for Pickup' || o.status === 'Driver Assigned').length;
    return orders.filter(o => o.status === key).length;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ height: 0, width: 0, opacity: 0 }}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          mediaPlaybackRequiresUserAction={false}
          source={{ html: `
            <html>
              <body>
                <audio id="audio" loop>
                  <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg">
                </audio>
              </body>
            </html>
          ` }}
        />
      </View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Management</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color="#9CA3AF" size={20} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search by Order ID..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
        {PHARMACY_TABS.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const count = getBadge(tab.key);
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab, 
                isActive && { backgroundColor: tab.color },
                index === PHARMACY_TABS.length - 1 ? { marginRight: 24 } : {} // extra padding at end
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? '#fff' : tab.color }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? tab.color : '#fff' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00C853" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {filteredOrders.length === 0 ? (
            <View style={styles.centerEmpty}>
              <Package color="#D1D5DB" size={80} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or checking another tab.</Text>
            </View>
          ) : (
            filteredOrders.map(order => (
              <View key={order.id} style={styles.orderCard}>
                {/* Header */}
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>#{order.numericId || order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.timeText}>
                      <Clock size={11} color="#9CA3AF" /> {getElapsedTime(order.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.orderAmount}>₹{order.totalAmount?.toFixed(2)}</Text>
                    {activeTab === 'Placed' && (
                      <View style={styles.slaBadge}>
                        <AlertTriangle size={12} color="#EF4444" />
                        <Text style={styles.slaText}>{formatRemaining(getRemainingTimeMs(order.createdAt))} left</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Delivery Address */}
                <View style={styles.addressRow}>
                  <Text style={styles.addressLabel}>📍 Deliver to: </Text>
                  <Text style={styles.addressText} numberOfLines={1}>{order.address}</Text>
                </View>

                {/* Items List */}
                {order.items?.length > 0 && (
                  <View style={styles.itemsList}>
                    {activeTab === 'Placed' && (
                       <Text style={{ fontSize: 11, color: '#EF4444', marginBottom: 8, fontWeight: 'bold' }}>Remove missing items before accepting</Text>
                    )}
                    {order.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemQty}>{item.qty}x</Text>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>₹{(item.price * item.qty).toFixed(2)}</Text>
                        {activeTab === 'Placed' && (
                          <TouchableOpacity style={{ marginLeft: 12, padding: 4 }} onPress={() => handleRemoveItem(order, idx)}>
                            <XCircle size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Prescription */}
                {order.prescriptionUrl && (
                  <TouchableOpacity onPress={() => setViewingRx(order.prescriptionUrl)} style={styles.rxBanner}>
                    <Eye color="#2563EB" size={16} />
                    <Text style={styles.rxBannerText}>Tap to View Prescription</Text>
                    <ChevronRight color="#2563EB" size={16} />
                  </TouchableOpacity>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {activeTab === 'Placed' && (
                    <>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleUpdateStatus(order.id, 'Cancelled')}>
                        <XCircle size={16} color="#EF4444" />
                        <Text style={styles.rejectTxt}> Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: order.prescriptionUrl ? '#3B82F6' : '#00C853' }]}
                        onPress={() => handleUpdateStatus(order.id, order.prescriptionUrl ? 'Verifying Prescription' : 'Accepted')}
                      >
                        <CheckCircle size={16} color="#fff" />
                        <Text style={styles.acceptTxt}> {order.prescriptionUrl ? 'Verify Rx' : 'Accept & Prep'}</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {activeTab === 'Verifying Prescription' && (
                    <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#3B82F6', flex: 1 }]} onPress={() => handleUpdateStatus(order.id, 'Accepted')}>
                      <CheckCircle size={16} color="#fff" />
                      <Text style={styles.acceptTxt}> Rx Verified — Start Preparing</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'Accepted' && (
                    <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#8B5CF6', flex: 1 }]} onPress={() => handleUpdateStatus(order.id, 'Ready for Pickup')}>
                      <Package size={16} color="#fff" />
                      <Text style={styles.acceptTxt}> Mark as Ready for Pickup</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'Ready for Pickup' && (
                    <View style={styles.otpContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <ShieldCheck color="#10B981" size={16} />
                        <Text style={styles.otpTitle}>Secure Handoff</Text>
                      </View>
                      <Text style={styles.otpSub}>Ask the delivery agent for their Pickup PIN to release the package.</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <TextInput
                          style={styles.otpInput}
                          placeholder="Enter PIN"
                          maxLength={6}
                          autoCapitalize="characters"
                          value={otpInputs[order.id] || ''}
                          onChangeText={(t) => setOtpInputs(prev => ({...prev, [order.id]: t}))}
                        />
                        <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerifyOtp(order)}>
                          <Text style={styles.verifyTxt}>Verify & Release</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {activeTab === 'History' && (
                    <View style={styles.historyFooter}>
                      <Text style={[styles.historyStatus, { color: (order.status === 'Delivered' || order.status === 'Picked Up' || order.status === 'Out for Delivery') ? '#10B981' : '#EF4444' }]}>
                        {order.status}
                      </Text>
                      {order.status === 'Delivered' && order.deliveredAt && (
                        <Text style={{ fontSize: 12, color: '#6B7280' }}>
                          Delivered {new Date(order.deliveredAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Prescription Viewer Modal */}
      <Modal visible={!!viewingRx} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Patient Prescription</Text>
              <TouchableOpacity onPress={() => setViewingRx(null)}>
                <XCircle color="#EF4444" size={28} />
              </TouchableOpacity>
            </View>
            <Image source={{ uri: viewingRx }} style={styles.rxImage} resizeMode="contain" />
            <TouchableOpacity style={styles.rxApproveBtn} onPress={() => setViewingRx(null)}>
              <Text style={styles.rxApproveTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 16, backgroundColor: '#fff', elevation: 4, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 44 : 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  liveText: { fontSize: 12, fontWeight: 'bold', color: '#065F46' },
  tabsScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexGrow: 0, flexShrink: 0, maxHeight: 65 },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  tabBadge: { marginLeft: 6, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 11, fontWeight: 'bold' },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  timeText: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  orderAmount: { fontSize: 20, fontWeight: 'bold', color: '#00C853' },
  addressRow: { flexDirection: 'row', marginBottom: 12 },
  addressLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  addressText: { fontSize: 13, color: '#374151', flex: 1 },
  itemsList: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  itemQty: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', width: 28 },
  itemName: { fontSize: 13, color: '#374151', flex: 1 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#111827' },
  rxBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  rxBannerText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#EF4444' },
  rejectTxt: { color: '#EF4444', fontWeight: 'bold' },
  acceptBtn: { flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  acceptTxt: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  slaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  slaText: { color: '#EF4444', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  otpContainer: { flex: 1, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  otpTitle: { fontSize: 14, fontWeight: 'bold', color: '#065F46', marginLeft: 6 },
  otpSub: { fontSize: 11, color: '#047857', lineHeight: 16 },
  otpInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, paddingHorizontal: 12, fontSize: 16, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  verifyBtn: { backgroundColor: '#10B981', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  verifyTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: '#F3F4F6' },
  historyStatus: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  rxImage: { flex: 1, width: '100%', backgroundColor: '#F3F4F6', borderRadius: 12 },
  rxApproveBtn: { backgroundColor: '#111827', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  rxApproveTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

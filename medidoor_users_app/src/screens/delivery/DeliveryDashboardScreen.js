import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  Platform, ActivityIndicator, Alert, Image, TextInput, Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Navigation, MapPin, CheckCircle, Clock, Package, IndianRupee, Search, ShieldCheck, Star } from 'lucide-react-native';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import * as Location from 'expo-location';
import OtpModal from '../../components/OtpModal';
import { calculateDistance } from '../../utils/distance';

const getEarning = (order) => {
  if (order.pharmacyLocation && order.customerLocation) {
    const dist = calculateDistance(order.pharmacyLocation, order.customerLocation);
    return Math.max(30, Math.floor(20 + (dist * 10)));
  }
  return order.deliveryFee ? Math.max(30, Math.floor(order.deliveryFee * 0.8)) : 40;
};

export default function DeliveryDashboardScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Available');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pharmacyMap, setPharmacyMap] = useState({}); // { pharmacyId: { name, address } }
  const [searchQuery, setSearchQuery] = useState('');
  const [riderProfile, setRiderProfile] = useState(null);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [dropoffOtpInputs, setDropoffOtpInputs] = useState({});
  const [currentLocation, setCurrentLocation] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
      setOrders(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      getDoc(doc(db, 'delivery_agents', currentUser.uid))
        .then(snap => {
          if (snap.exists()) setRiderProfile(snap.data());
        })
        .catch(err => console.error("Error fetching rider profile:", err));
    }
  }, [currentUser]);

  // Whenever orders change, fetch any unknown pharmacy info
  useEffect(() => {
    const uniqueIds = [...new Set(orders.map(o => o.pharmacyId).filter(Boolean))];
    const unknownIds = uniqueIds.filter(id => !pharmacyMap[id]);
    if (unknownIds.length === 0) return;

    Promise.all(unknownIds.map(id => getDoc(doc(db, 'pharmacies', id))))
      .then(snaps => {
        const updates = {};
        snaps.forEach(snap => {
          if (snap.exists()) {
            updates[snap.id] = {
              name: snap.data().name || 'Pharmacy',
              address: snap.data().address || ''
            };
          }
        });
        if (Object.keys(updates).length > 0) {
          setPharmacyMap(prev => ({ ...prev, ...updates }));
        }
      })
      .catch(err => console.error('Pharmacy fetch error:', err));
  }, [orders]);

  const webViewRef = React.useRef(null);
  const knownDeliveryIds = React.useRef(new Set());

  // Riders should only see orders that are actually ready for pickup
  const availableOrders = orders.filter(o => o.status === 'Ready for Pickup' && !o.riderId);

  // Audio Alerts for New Available Deliveries
  useEffect(() => {
    const manageAudio = async () => {
      let hasNewOrder = false;

      availableOrders.forEach(order => {
        if (!knownDeliveryIds.current.has(order.id)) {
          hasNewOrder = true;
          knownDeliveryIds.current.add(order.id);
        }
      });

      if (hasNewOrder) {
        Alert.alert('New Delivery Available!', 'A pharmacy has an order ready for pickup.');
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              var audio = document.getElementById('audio');
              if (audio) {
                audio.play();
                setTimeout(function() { audio.pause(); audio.currentTime = 0; }, 5000);
              }
            })();
            true;
          `);
        }
      }
    };
    manageAudio();
  }, [availableOrders]);
  const myActiveOrders = orders.filter(o => (o.status === 'Out for Delivery' || o.status === 'Driver Assigned' || o.status === 'Picked Up') && o.riderId === currentUser?.uid);
  const myCompletedOrders = orders.filter(o => (o.status === 'Delivered' || o.status === 'Cancelled') && o.riderId === currentUser?.uid);

  // Average Rating
  const ratedOrders = myCompletedOrders.filter(o => typeof o.deliveryRating === 'number');
  const avgRating = ratedOrders.length > 0
    ? (ratedOrders.reduce((sum, o) => sum + o.deliveryRating, 0) / ratedOrders.length).toFixed(1)
    : 'New';

  // Live Location Tracking (Compulsory)
  useEffect(() => {
    let locationSubscription = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation({ latitude, longitude });

          // Update the rider's master document so system knows they are active
          if (currentUser) {
            try {
              await updateDoc(doc(db, 'delivery_agents', currentUser.uid), {
                liveLocation: { latitude, longitude },
                lastActive: Date.now()
              });
            } catch (err) { }
          }

          // Update all active orders with this rider's live location
          myActiveOrders.forEach(async (order) => {
            try {
              await updateDoc(doc(db, 'orders', order.id), {
                riderLocation: { latitude, longitude }
              });
            } catch (err) {
              console.log('Error updating live location', err);
            }
          });
        }
      );
    };

    startTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [myActiveOrders.length, currentUser]);

  const getFilteredOrders = () => {
    if (activeTab === 'Available') {
      const sortedAvailable = [...availableOrders];
      if (currentLocation) {
        sortedAvailable.sort((a, b) => {
          const distA = calculateDistance(currentLocation, a.pharmacyLocation) || 999;
          const distB = calculateDistance(currentLocation, b.pharmacyLocation) || 999;
          return distA - distB;
        });
      }
      return sortedAvailable;
    }
    if (activeTab === 'Active') return myActiveOrders;
    return myCompletedOrders;
  };

  const handleAcceptDelivery = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'Driver Assigned',
        riderId: currentUser.uid,
        driverName: riderProfile?.name || currentUser.displayName || 'Delivery Partner',
        acceptedAt: Date.now(),
      });
      setAcceptModalVisible(true);
      setActiveTab('Active');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept delivery. Please try again.');
    }
  };

  const handleInitiateDelivery = (order) => {
    if (order.status !== 'Picked Up' && order.status !== 'Out for Delivery') {
      Alert.alert("Pickup First", "Show your Pickup PIN to the pharmacy. They must enter it to release the order to you.");
      return;
    }
    setSelectedOrderForDelivery(order);
    setOtpModalVisible(true);
  };

  const handleConfirmOtp = async (order, inputOtp) => {
    const expectedOtp = order.dropoffOtp || order.numericId || order.id.slice(-6).toUpperCase();
    if (inputOtp !== expectedOtp) {
      Alert.alert("Invalid PIN", "Please ask the customer for the correct 6-digit Drop-off PIN.");
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'Delivered',
        deliveredAt: Date.now()
      });
      const earning = getEarning(order);
      Alert.alert('✅ Delivery Complete!', `Great job! ₹${earning} added to your earnings.`);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not complete delivery.");
    }
  };


  const TABS = [
    { key: 'Available', label: 'Available', count: availableOrders.length, color: '#10B981' },
    { key: 'Active', label: 'My Active', count: myActiveOrders.length, color: '#3B82F6' },
    { key: 'Completed', label: 'Completed', count: myCompletedOrders.length, color: '#6B7280' },
  ];

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
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online & Ready</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { flexShrink: 1 }]} numberOfLines={1}>Rider Dashboard</Text>
            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 10 }}>
              <Text style={{ color: '#D97706', fontSize: 12, fontWeight: 'bold' }}>★ {avgRating}</Text>
            </View>
          </View>
        </View>
        <View style={styles.earningsChip}>
          <IndianRupee color="#10B981" size={14} />
          <Text style={styles.earningsChipText}>{myCompletedOrders.reduce((sum, order) => sum + getEarning(order), 0)}</Text>
          <Text style={styles.earningsChipLabel}> today</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color="#9CA3AF" size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order ID or Pharmacy..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: tab.color, borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: tab.color, fontWeight: 'bold' }]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.badge, { backgroundColor: tab.color }]}>
                <Text style={styles.badgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>
      ) : (
        <FlatList
          data={getFilteredOrders()}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centerEmpty}>
              <Navigation color="#D1D5DB" size={80} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'Available' ? 'No orders ready yet' : `No ${activeTab.toLowerCase()} orders`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'Available'
                  ? 'Once a pharmacy marks an order ready, it will appear here.'
                  : 'Your deliveries will show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (activeTab === 'Completed') {
              return (
                <View style={[styles.orderCard, { borderColor: '#E5E7EB', borderWidth: 1 }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.orderId}>#{item.numericId || item.id.slice(-6).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.payout, { color: '#6B7280', fontSize: 13, marginRight: 6 }]}>Delivered</Text>
                      <CheckCircle color="#10B981" size={16} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginVertical: 12 }}>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#6B7280', fontSize: 12 }}>Customer Rating</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Star color="#F59E0B" size={14} fill={typeof item.deliveryRating === 'number' ? "#F59E0B" : "none"} />
                        <Text style={{ fontWeight: 'bold', marginLeft: 4, color: '#374151' }}>
                          {typeof item.deliveryRating === 'number' ? `${item.deliveryRating.toFixed(1)}` : 'None'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.routeContainer}>
                    <View style={styles.locationRow}>
                      <View style={[styles.locationDot, { backgroundColor: '#3B82F6' }]} />
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>Pickup from</Text>
                        <Text style={styles.locationValue} numberOfLines={1}>{pharmacyMap[item.pharmacyId]?.name || 'Pharmacy'}</Text>
                      </View>
                    </View>
                    <View style={styles.routeConnector} />
                    <View style={styles.locationRow}>
                      <View style={[styles.locationDot, { backgroundColor: '#F59E0B' }]} />
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>Dropoff to</Text>
                        <Text style={styles.locationValue} numberOfLines={1}>{item.address || 'Customer'}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                    Completed on {new Date(item.deliveredAt || item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              );
            }

            const distanceKm = (activeTab === 'Available' && currentLocation)
              ? calculateDistance(currentLocation, item.pharmacyLocation)
              : null;

            return (
              <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>#{item.numericId || item.id.slice(-6).toUpperCase()}</Text>
                  {distanceKm !== null && (
                    <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ color: '#065F46', fontSize: 12, fontWeight: 'bold' }}>
                        {distanceKm.toFixed(1)} km away
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.itemSummary} numberOfLines={2}>
                  {item.items?.map(i => `${i.qty}x ${i.name}`).join(', ') || 'Order items'}
                </Text>

                <View style={styles.routeContainer}>
                  <View style={styles.locationRow}>
                    <View style={[styles.locationDot, { backgroundColor: '#3B82F6' }]} />
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationLabel}>Pickup from</Text>
                      <Text style={styles.locationValue}>{pharmacyMap[item.pharmacyId]?.name || 'Pharmacy'}</Text>
                    </View>
                  </View>
                  <View style={styles.routeConnector} />
                  <View style={styles.locationRow}>
                    <View style={[styles.locationDot, { backgroundColor: '#10B981' }]} />
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationLabel}>Dropoff</Text>
                      <Text style={styles.locationValue} numberOfLines={1}>{item.address}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={styles.orderTotal}>Order Value: ₹{item.totalAmount?.toFixed(2)}</Text>
                  <Text style={styles.orderPayment}>{item.paymentMethod === 'cod' ? '💵 COD' : '💳 Online'}</Text>
                </View>

                {activeTab === 'Available' && (
                  myActiveOrders.length >= 1 ? (
                    <View style={[styles.acceptBtn, { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[styles.acceptBtnText, { color: '#9CA3AF' }]}>Complete active order first</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptDelivery(item.id)}
                    >
                      <Navigation color="#fff" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.acceptBtnText}>Accept Delivery</Text>
                    </TouchableOpacity>
                  )
                )}

                {activeTab === 'Active' && (
                  <View style={{ marginTop: 12 }}>
                    {item.status !== 'Picked Up' && item.status !== 'Out for Delivery' && (
                      <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <ShieldCheck color="#047857" size={18} />
                          <Text style={{ color: '#047857', fontWeight: 'bold', marginLeft: 6, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pickup PIN</Text>
                        </View>
                        <Text style={{ fontSize: 28, fontWeight: '900', color: '#065F46', letterSpacing: 6 }}>
                          {item.pickupOtp || (item.numericId || item.id).slice(-4).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.activeActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#EFF6FF', flex: 1, marginRight: 8, borderWidth: 1, borderColor: '#BFDBFE' }]}
                        onPress={() => navigation.navigate('Map', { order: item, pharmacyName: pharmacyMap[item.pharmacyId]?.name, pharmacyAddress: pharmacyMap[item.pharmacyId]?.address })}
                      >
                        <Navigation color="#2563EB" size={16} />
                        <Text style={[styles.actionBtnText, { color: '#2563EB' }]}> View Map</Text>
                      </TouchableOpacity>
                      {item.status !== 'Picked Up' && item.status !== 'Out for Delivery' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#F59E0B', flex: 1 }]}
                          onPress={() => handleInitiateDelivery(item)}
                        >
                          <CheckCircle color="#fff" size={16} />
                          <Text style={styles.actionBtnText}> Picked Up</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {(item.status === 'Picked Up' || item.status === 'Out for Delivery') && (
                      <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#A7F3D0' }}>
                        <Text style={{ fontSize: 13, color: '#047857', fontWeight: 'bold', marginBottom: 8 }}>DELIVER PACKAGE</Text>
                        <Text style={{ fontSize: 12, color: '#065F46', marginBottom: 12 }}>Enter the 6-digit Customer PIN to complete the delivery.</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TextInput
                            style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 4, marginRight: 12 }}
                            placeholder="Enter PIN"
                            maxLength={6}
                            autoCapitalize="characters"
                            value={dropoffOtpInputs[item.id] || ''}
                            onChangeText={(t) => setDropoffOtpInputs(prev => ({ ...prev, [item.id]: t }))}
                          />
                          <TouchableOpacity
                            style={{ backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, justifyContent: 'center' }}
                            onPress={() => handleConfirmOtp(item, dropoffOtpInputs[item.id])}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Deliver</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          }}
        />
      )}

      {/* Modern Acceptance Toast Modal */}
      <Modal visible={acceptModalVisible} transparent={true} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastCard}>
            <View style={styles.toastIconCircle}>
              <Text style={{ fontSize: 32 }}>🛵</Text>
            </View>
            <Text style={styles.toastTitle}>Delivery Accepted!</Text>
            <Text style={styles.toastDesc}>Head to the pharmacy to pick up the order. Show them your Pickup PIN when you arrive.</Text>

            <TouchableOpacity
              style={styles.toastOkBtn}
              onPress={() => setAcceptModalVisible(false)}
            >
              <Text style={styles.toastOkBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 44 : 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  onlineText: { fontSize: 12, color: '#10B981', fontWeight: 'bold' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  earningsChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  earningsChipText: { fontSize: 18, fontWeight: 'bold', color: '#065F46' },
  earningsChipLabel: { fontSize: 12, color: '#6B7280' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderBottomColor: 'transparent', borderBottomWidth: 2.5 },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  badge: { marginLeft: 6, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  list: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerEmpty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  payout: { fontSize: 18, fontWeight: 'bold', color: '#10B981' },
  itemSummary: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  routeContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  locationInfo: { flex: 1 },
  locationLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationValue: { fontSize: 14, color: '#374151', fontWeight: '500', marginTop: 1 },
  locationSubValue: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  routeConnector: { width: 2, height: 16, backgroundColor: '#E5E7EB', marginLeft: 4, marginVertical: 4 },
  orderMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  orderTotal: { fontSize: 13, color: '#6B7280' },
  orderPayment: { fontSize: 13, color: '#374151', fontWeight: '500' },
  acceptBtn: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  activeActions: { flexDirection: 'row' },
  actionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 10, justifyContent: 'center' },
  completedText: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', margin: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },
  toastOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  toastCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  toastIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  toastTitle: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 12, textAlign: 'center' },
  toastDesc: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  toastOkBtn: { backgroundColor: '#10B981', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  toastOkBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

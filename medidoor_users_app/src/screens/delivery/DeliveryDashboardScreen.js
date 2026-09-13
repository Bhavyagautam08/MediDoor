import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  Platform, ActivityIndicator, Alert, Image, TextInput, Modal, BackHandler, ScrollView, KeyboardAvoidingView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Navigation, MapPin, CheckCircle, Clock, Package, IndianRupee, Search, ShieldCheck, Star, Bell, XCircle } from 'lucide-react-native';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import * as Location from 'expo-location';
import OtpModal from '../../components/OtpModal';
import OtpInput from '../../components/OtpInput';
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState(null);
  const [recentSearchQuery, setRecentSearchQuery] = useState('');
  const currentUser = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((d) => fetched.push({ id: d.id, ...d.data() }));
      setOrders(fetched);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('Orders snapshot error:', err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'delivery_agents', currentUser.uid, 'notifications'),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('Notifications snapshot error:', err);
    });
    return () => unsubscribe();
  }, [currentUser]);

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
              address: snap.data().address || '',
              location: snap.data().location || null
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

  // Riders should see any active order that hasn't been assigned to a driver
  const availableOrders = orders.filter(o => !o.riderId && o.status !== 'Delivered' && !['Cancelled', 'cancelled', 'Canceled', 'canceled'].includes(o.status));

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
  const myActiveOrders = orders.filter(o => o.riderId === currentUser?.uid && o.status !== 'Delivered' && !['Cancelled', 'cancelled', 'Canceled', 'canceled'].includes(o.status));
  const myCompletedOrders = orders.filter(o => (o.status === 'Delivered' || ['Cancelled', 'cancelled', 'Canceled', 'canceled'].includes(o.status)) && o.riderId === currentUser?.uid);

  const avgRating = riderProfile?.rating ? parseFloat(riderProfile.rating).toFixed(1) : 'New';

  // Live Location Tracking (Compulsory)
  useEffect(() => {
    let locationSubscription = null;
    let checkInterval = null;

    const enforceLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Delivery Partners must grant location access.',
          [{ text: 'Exit App', onPress: () => BackHandler.exitApp() }],
          { cancelable: false }
        );
        return false;
      }
      
      const provider = await Location.getProviderStatusAsync();
      if (!provider.locationServicesEnabled) {
        Alert.alert(
          'GPS Disabled',
          'Your GPS is currently turned off. Location services are mandatory for delivery tracking.',
          [{ text: 'Exit App', onPress: () => BackHandler.exitApp() }],
          { cancelable: false }
        );
        return false;
      }
      return true;
    };

    const startTracking = async () => {
      const isAllowed = await enforceLocation();
      if (!isAllowed) return;

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

    // Continuously monitor GPS status every 10 seconds
    checkInterval = setInterval(async () => {
      const provider = await Location.getProviderStatusAsync();
      if (!provider.locationServicesEnabled) {
        Alert.alert(
          'GPS Signal Lost',
          'Your GPS was turned off. Please turn it back on to continue, or log out.',
          [
            { text: 'Log Out', onPress: async () => { await auth.signOut(); } },
            { text: 'Exit App', onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: false }
        );
      }
    }, 10000);

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (checkInterval) {
        clearInterval(checkInterval);
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

  const handleAcceptDelivery = async (order) => {
    try {
      const updates = {
        riderId: currentUser.uid,
        driverName: riderProfile?.name || currentUser.displayName || 'Delivery Partner',
        driverPhone: riderProfile?.phone || riderProfile?.email || '',
        driverPhoto: riderProfile?.profileImage || riderProfile?.profilePhoto || riderProfile?.photoUrl || riderProfile?.documents?.photo || currentUser?.photoURL || '',
        acceptedAt: Date.now(),
      };
      
      // If the pharmacy already marked it Ready for Pickup, change status. Otherwise, just assign rider.
      if (order.status === 'Ready for Pickup') {
        updates.status = 'Driver Assigned';
      }

      await updateDoc(doc(db, 'orders', order.id), updates);
      setAcceptModalVisible(true);
      setActiveTab('Active');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept delivery. Please try again.');
    }
  };

  const handleArrivedAtPickup = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'Driver Arrived',
        driverArrivedAt: Date.now(),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update status. Please try again.');
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
      const earning = getEarning(order);
      let cashOwed = 0;
      
      if (order.paymentMethod === 'cod') {
        const total = order.totalAmount || 0;
        cashOwed = total - earning;
        if (cashOwed < 0) cashOwed = 0; 
      }
      
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'Delivered',
        deliveredAt: Date.now()
      });

      if (cashOwed > 0 && currentUser) {
        const newFloatingCash = (riderProfile?.floatingCash || 0) + cashOwed;
        await updateDoc(doc(db, 'delivery_agents', currentUser.uid), {
          floatingCash: newFloatingCash
        });
        setRiderProfile(prev => ({ ...prev, floatingCash: newFloatingCash }));
      }
      
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
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.earningsChip}>
            <IndianRupee color="#10B981" size={14} />
            <Text style={styles.earningsChipText}>{myCompletedOrders.reduce((sum, order) => sum + getEarning(order), 0)}</Text>
            <Text style={styles.earningsChipLabel}> today</Text>
          </View>
          <TouchableOpacity 
            style={{ position: 'relative', backgroundColor: '#F3F4F6', padding: 8, borderRadius: 20 }}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell color="#4B5563" size={20} />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
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
                <TouchableOpacity 
                  style={[styles.orderCard, { borderColor: '#E5E7EB', borderWidth: 1 }]}
                  onPress={() => setSelectedDeliveryOrder(item)}
                  activeOpacity={0.9}
                >
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
                </TouchableOpacity>
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
                      onPress={() => handleAcceptDelivery(item)}
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
                        onPress={() => navigation.navigate('Map', { order: item, pharmacyName: pharmacyMap[item.pharmacyId]?.name, pharmacyAddress: pharmacyMap[item.pharmacyId]?.address, pharmacyLocation: pharmacyMap[item.pharmacyId]?.location })}
                      >
                        <Navigation color="#2563EB" size={16} />
                        <Text style={[styles.actionBtnText, { color: '#2563EB' }]}> View Map</Text>
                      </TouchableOpacity>
                      {item.status === 'Driver Assigned' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#8B5CF6', flex: 1 }]}
                          onPress={() => handleArrivedAtPickup(item.id)}
                        >
                          <MapPin color="#fff" size={16} />
                          <Text style={styles.actionBtnText}> Arrived at Pickup</Text>
                        </TouchableOpacity>
                      )}
                      {(item.status === 'Driver Arrived') && (
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
                        <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                          <OtpInput
                            length={6}
                            value={dropoffOtpInputs[item.id] || ''}
                            onChangeText={(t) => setDropoffOtpInputs(prev => ({ ...prev, [item.id]: t }))}
                          />
                          <TouchableOpacity
                            style={{ backgroundColor: '#10B981', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', width: '100%', alignItems: 'center', marginTop: 12 }}
                            onPress={() => handleConfirmOtp(item, dropoffOtpInputs[item.id])}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Deliver</Text>
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

      {/* Recent Deliveries Section - removed, ordering is done in FlatList */}

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

      {/* Order Detail Modal for delivery partner */}
      <Modal visible={!!selectedDeliveryOrder} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>Delivery Details</Text>
              <TouchableOpacity onPress={() => setSelectedDeliveryOrder(null)}>
                <XCircle color="#EF4444" size={28} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 8 }}>Order ID</Text>
              <Text style={{ fontSize: 16, color: '#111827', marginTop: 4, fontWeight: '500' }}>#{selectedDeliveryOrder?.numericId || selectedDeliveryOrder?.id?.slice(-6).toUpperCase()}</Text>

              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 16 }}>Status</Text>
              <Text style={{ fontSize: 16, color: '#111827', marginTop: 4, fontWeight: '500' }}>{selectedDeliveryOrder?.status}</Text>

              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 16 }}>Pickup From</Text>
              <Text style={{ fontSize: 16, color: '#111827', marginTop: 4, fontWeight: '500' }}>{pharmacyMap[selectedDeliveryOrder?.pharmacyId]?.name || 'Pharmacy'}</Text>

              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 16 }}>Delivered To</Text>
              <Text style={{ fontSize: 16, color: '#111827', marginTop: 4, fontWeight: '500' }}>{selectedDeliveryOrder?.customerName || 'Customer'}</Text>
              <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>{selectedDeliveryOrder?.address}</Text>

              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 16 }}>Items</Text>
              <View style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                {(selectedDeliveryOrder?.items || []).map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 14, color: '#4B5563' }}>{item.qty} x {item.name}</Text>
                    <Text style={{ fontSize: 14, color: '#111827', fontWeight: '600' }}>₹{(item.price * item.qty).toFixed(2)}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827' }}>Total</Text>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#111827' }}>₹{(selectedDeliveryOrder?.totalAmount || 0).toFixed(2)}</Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginTop: 16 }}>Your Rating</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                {[1,2,3,4,5].map(i => (
                  <Star key={i} color="#F59E0B" size={22} fill={i <= (selectedDeliveryOrder?.deliveryRating || 0) ? '#F59E0B' : 'none'} style={{ marginRight: 4 }} />
                ))}
                <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: '#374151' }}>
                  {typeof selectedDeliveryOrder?.deliveryRating === 'number' ? selectedDeliveryOrder.deliveryRating.toFixed(1) : 'Not yet rated'}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Cash Blocker Overlay */}
      {riderProfile?.floatingCash >= 2000 && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
          <View style={{ backgroundColor: '#FEF2F2', padding: 24, borderRadius: 24, alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 60, marginBottom: 12 }}>⚠️</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#991B1B', textAlign: 'center', marginBottom: 8 }}>Limit Exceeded</Text>
            <Text style={{ fontSize: 16, color: '#7F1D1D', textAlign: 'center', marginBottom: 24, lineHeight: 24 }}>
              You are currently holding <Text style={{fontWeight: 'bold'}}>₹{riderProfile.floatingCash}</Text> in Cash on Delivery (COD) funds. The maximum allowed limit is ₹2,000.
            </Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#EF4444', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
              onPress={() => navigation.navigate('Earnings')}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Deposit Cash to Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </KeyboardAvoidingView>
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

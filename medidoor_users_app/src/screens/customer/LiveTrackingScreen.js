import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Dimensions, Linking, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, MessageSquare, Map as MapIcon, CheckCircle2, Circle, Clock, X, Maximize2, MapPin, Home, Navigation } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { doc, getDoc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useDispatch } from 'react-redux';
import { restoreCart } from '../../store/slices/cartSlice';
import RatingModal from '../../components/RatingModal';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const { width, height } = Dimensions.get('window');

const scheduleDriverAssignedAlert = async (order) => {
  const baseContent = {
    title: 'Driver Assigned! 🛵',
    body: `${order.driverName || 'A delivery partner'} is heading to the pharmacy to pick up your order.`,
    data: { type: 'driver_assigned', orderId: order.id },
    ...(Platform.OS === 'android' ? {
      android: {
        channelId: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: false,
      },
    } : {}),
  };

  await Notifications.scheduleNotificationAsync({
    content: baseContent,
    trigger: null,
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      ...baseContent,
      body: `${baseContent.body} Reminder`,
    },
    trigger: { seconds: 10 },
  });
};

export default function LiveTrackingScreen({ navigation, route }) {
  const { orderId } = route.params || { orderId: 'N/A' };
  const dispatch = useDispatch();

  const [order, setOrder] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [pharmacyCoords, setPharmacyCoords] = useState(null);
  const [pharmacyDetails, setPharmacyDetails] = useState(null);
  const [eta, setEta] = useState(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const prevStatusRef = React.useRef(null);

  useEffect(() => {
    if (orderId === 'N/A') return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder({ id: docSnap.id, ...data });

        if (!pharmacyCoords && data.pharmacyId) {
          const pDoc = await getDoc(doc(db, 'pharmacies', data.pharmacyId));
          if (pDoc.exists()) {
            const pData = pDoc.data();
            if (pData.latitude) {
              setPharmacyCoords({ latitude: pData.latitude, longitude: pData.longitude });
            }
            setPharmacyDetails({ name: pData.name, address: pData.address });
          }
        }
      }
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (order && order.status) {
      if (prevStatusRef.current && prevStatusRef.current !== order.status) {
        if (order.status === 'Driver Assigned') {
          scheduleDriverAssignedAlert(order);
        }
      }
      prevStatusRef.current = order.status;
    }
  }, [order]);

  useEffect(() => {
    if (order?.status === 'Cancelled') {
      Alert.alert('Order Cancelled', 'This order has been cancelled and is no longer trackable.');
    }
  }, [order?.status]);

  if (order?.status === 'Cancelled') {
    return (
      <SafeAreaView style={styles.cancelledContainer}>
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledTitle}>Order Cancelled</Text>
          <Text style={styles.cancelledSubtitle}>The pharmacy has cancelled this order. Tracking is now disabled.</Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    (async () => {
      if (order?.customerLocation) {
        setCustomerLocation(order.customerLocation);
      } else {
        // Fallback to a distant location so it doesn't overlap the rider during same-device testing
        setCustomerLocation({ latitude: 28.5200, longitude: 77.4000 });
      }
    })();
  }, [order?.customerLocation]);

  const handleReorder = async (orderItems) => {
    // If it's a broadcasted prescription order, rebroadcast it
    if (order.prescriptionUrl && orderItems[0]?.id === 'prescription_quote') {
      try {
        const user = auth.currentUser;
        if (!user) return;

        let { status } = await Location.getForegroundPermissionsAsync();
        let coords = null;
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = loc.coords;
        } else {
          Alert.alert('Location Required', 'We need your location to broadcast the prescription.');
          return;
        }

        const docRef = await addDoc(collection(db, 'prescription_requests'), {
          customerId: user.uid,
          customerLocation: {
            latitude: coords.latitude,
            longitude: coords.longitude
          },
          imageUrl: order.prescriptionUrl,
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        navigation.navigate('PrescriptionQuotes', { requestId: docRef.id });
      } catch (err) {
        console.error("Re-broadcast error", err);
        Alert.alert("Error", "Could not re-broadcast your prescription.");
      }
    } else {
      // Normal Cart Order -> Go to Cart
      dispatch(restoreCart(orderItems || []));
      navigation.navigate('Cart');
    }
  };

  if (!order) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#0D9494" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading your order...</Text>
      </View>
    );
  }

  // Standardized numeric order ID across all apps
  const shortOrderId = order.numericId || (orderId ? orderId.slice(-6).toUpperCase() : 'N/A');
  const orderStatus = order.status || 'Placed';
  const isDelivered = orderStatus === 'Delivered';
  const hasRated = order.serviceRating !== undefined || order.deliveryRating !== undefined;

  const handleRatingSubmit = async ({ pharmacyRating, driverRating, review }) => {
    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData = { reviewText: review || '' };

      if (pharmacyRating > 0) {
        updateData.serviceRating = pharmacyRating;
        if (order.pharmacyId) {
          const pRef = doc(db, 'pharmacies', order.pharmacyId);
          const pDoc = await getDoc(pRef);
          if (pDoc.exists()) {
            const pd = pDoc.data();
            let currentCount = pd.reviewCount || 0;
            let currentTotal = pd.totalRating || 0;
            if (currentCount === 0 && pd.rating) {
              currentCount = 1;
              currentTotal = parseFloat(pd.rating);
            }
            const newTotal = currentTotal + pharmacyRating;
            const newCount = currentCount + 1;
            const newRating = (newTotal / newCount).toFixed(1);
            await setDoc(pRef, { rating: newRating, reviewCount: newCount, totalRating: newTotal }, { merge: true });
          }
        }
      }

      if (driverRating > 0) {
        updateData.deliveryRating = driverRating;
        if (order.riderId) {
          const dRef = doc(db, 'delivery_agents', order.riderId);
          const dDoc = await getDoc(dRef);
          if (dDoc.exists()) {
            const dd = dDoc.data();
            let currentCount = dd.reviewCount || 0;
            let currentTotal = dd.totalRating || 0;
            if (currentCount === 0 && dd.rating) {
              currentCount = 1;
              currentTotal = parseFloat(dd.rating);
            }
            const newTotal = currentTotal + driverRating;
            const newCount = currentCount + 1;
            const newRating = (newTotal / newCount).toFixed(1);
            await setDoc(dRef, { rating: newRating, reviewCount: newCount, totalRating: newTotal }, { merge: true });
          }
        }
      }

      await setDoc(orderRef, updateData, { merge: true });
      setShowRatingModal(false);
    } catch (error) {
      console.error("Failed to submit rating:", error);
    }
  };

  const getStatusIndex = () => {
    const s = orderStatus.toLowerCase();
    if (s.includes('out') || s.includes('coming') || s.includes('towards') || s.includes('way') || (s.includes('pick') && !s.includes('ready'))) return 5;
    if (s.includes('reach') || s.includes('shop')) return 4;
    if (s.includes('ready') || s.includes('assign')) return 3;
    if (s.includes('confirm') || s.includes('prepar') || s.includes('accept') || s.includes('verify')) return 2;
    return 1;
  };

  const currentStep = getStatusIndex();
  const orderDate = new Date(order.createdAt);
  const timeString = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + timeString;

  const numItems = order.items ? order.items.reduce((sum, item) => sum + item.qty, 0) : 1;

  // Exact Billing from Firestore
  const subtotal = order.subtotal || order.items?.reduce((acc, item) => acc + ((item.price * item.qty) || 0), 0) || 0;
  const deliveryFee = order.deliveryFee || 0;
  const serviceFee = order.serviceFee || 15;
  const grandTotal = order.totalAmount || (subtotal + deliveryFee + serviceFee);

  return (
    <View style={styles.mainContainer}>
      {isDelivered ? (
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
                <ArrowLeft color="#111827" size={24} />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>ORDER #{shortOrderId}</Text>
                <Text style={styles.headerSubtitle}>Delivered , {numItems} Item{numItems > 1 ? 's' : ''} , ₹{grandTotal}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.helpBtn} onPress={() => navigation.navigate('HelpSupport')}>
              <Text style={styles.helpBtnText}>HELP</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.historicalWrapper}>
              <View style={styles.histTimeline}>
                <View style={styles.histRow}>
                  <MapPin color="#EA580C" size={20} />
                  <View style={styles.histTextContainer}>
                    <Text style={styles.histTitle}>{pharmacyDetails?.name || order.pharmacyName || 'Pharmacy Partner'}</Text>
                    <Text style={styles.histSub}>{pharmacyDetails?.address || order.pharmacyAddress || 'Local Address'}</Text>
                  </View>
                </View>
                <View style={styles.histDottedLine} />
                <View style={styles.histRow}>
                  <Home color="#4B5563" size={20} />
                  <View style={styles.histTextContainer}>
                    <Text style={styles.histTitle}>Home</Text>
                    <Text style={styles.histSub}>{order.deliveryAddress || order.customerAddress || order.address || 'Your Address'}</Text>
                  </View>
                </View>
                <View style={styles.histSolidLine} />
                <View style={styles.histRow}>
                  <CheckCircle2 color="#10B981" size={20} />
                  <View style={[styles.histTextContainer, { flex: 1 }]}>
                    <Text style={styles.histSub}>Order delivered on {fullDateStr} by {order.driverName || 'Partner'}</Text>
                  </View>
                  <View style={styles.onTimeBadge}><Text style={styles.onTimeText}>ON TIME</Text></View>
                </View>
              </View>

              <View style={styles.histDivider} />

              <View style={styles.billDetailsContainer}>
                <Text style={styles.billDetailsHeader}>BILL DETAILS</Text>

                {order.items && order.items.map((item, index) => (
                  <View key={index} style={styles.billItemRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.billItemName}>{item.name} x {item.qty}</Text>
                    </View>
                    <Text style={styles.billItemPrice}>₹{(item.price * item.qty).toFixed(2)}</Text>
                  </View>
                ))}

                <View style={styles.billBreakdown}>
                  <View style={styles.billRow}><Text style={styles.billRowLabel}>Subtotal</Text><Text style={styles.billRowVal}>₹{subtotal.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billRowLabel}>Delivery Charge</Text><Text style={styles.billRowVal}>₹{deliveryFee.toFixed(2)}</Text></View>
                  <View style={styles.billRow}><Text style={styles.billRowLabel}>Service Fee</Text><Text style={styles.billRowVal}>₹{serviceFee.toFixed(2)}</Text></View>
                </View>

                <View style={styles.billFooterRow}>
                  <Text style={styles.billFooterMethod}>Paid Via {order.paymentMethod || 'Online'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.billFooterTotalLabel}>Bill Total</Text>
                    <Text style={styles.billFooterTotalVal}>₹{grandTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      ) : (
        <View style={styles.mainContainer}>
          <MapView
            style={{ width: '100%', height: '100%' }}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: customerLocation ? (customerLocation.latitude + (pharmacyCoords?.latitude || customerLocation.latitude)) / 2 : 28.5450,
              longitude: customerLocation ? (customerLocation.longitude + (pharmacyCoords?.longitude || customerLocation.longitude)) / 2 : 77.3960,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker coordinate={customerLocation || { latitude: 28.5450, longitude: 77.3960 }} title="Dropoff: Customer" pinColor="#F59E0B" zIndex={1} />

            {pharmacyCoords && (
              <Marker coordinate={pharmacyCoords} title="Pharmacy" pinColor="#3B82F6" zIndex={1} />
            )}

            {!['Picked Up', 'Out for Delivery', 'Delivered'].includes(orderStatus) && pharmacyCoords && GOOGLE_MAPS_APIKEY && (
              <MapViewDirections
                origin={pharmacyCoords}
                destination={customerLocation || { latitude: 28.5450, longitude: 77.3960 }}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={3}
                strokeColor="#9CA3AF"
                lineDashPattern={[5, 5]}
              />
            )}

            {order.riderLocation && GOOGLE_MAPS_APIKEY && (
              <MapViewDirections
                origin={order.riderLocation}
                destination={['Picked Up', 'Out for Delivery'].includes(orderStatus) ? (customerLocation || { latitude: 28.5450, longitude: 77.3960 }) : (pharmacyCoords || { latitude: 28.5355, longitude: 77.3910 })}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#3B82F6"
                onReady={(result) => setEta(Math.ceil(result.duration))}
              />
            )}

            {order.riderLocation && (
              <>
                <Marker
                  coordinate={order.riderLocation}
                  flat={true}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={999}
                >
                  <View style={{
                    backgroundColor: '#fff',
                    padding: 6,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderColor: '#3B82F6',
                    elevation: 5,
                    transform: [{ rotate: `${(order.riderLocation.heading || 0) - 45}deg` }]
                  }}>
                    <Navigation color="#3B82F6" size={24} fill="#3B82F6" />
                  </View>
                </Marker>

                {eta !== null && (
                  <Marker
                    coordinate={order.riderLocation}
                    zIndex={1000}
                    anchor={{ x: 0.5, y: 1.5 }}
                  >
                    <View style={styles.etaBubble}>
                      <Text style={styles.etaBubbleText}>ETA : {eta} MINS</Text>
                      <View style={styles.etaBubbleTriangle} />
                    </View>
                  </Marker>
                )}
              </>
            )}
          </MapView>

          <SafeAreaView style={styles.floatingTopHeader} pointerEvents="box-none">
            <View style={styles.floatingTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity style={styles.floatingBackBtn} onPress={() => navigation.goBack()}>
                  <ArrowLeft color="#111827" size={24} />
                </TouchableOpacity>
                <View style={styles.floatingOrderInfo}>
                  <Text style={styles.floatingOrderId}>ORDER #{shortOrderId}</Text>
                  <Text style={styles.floatingOrderSub}>{timeString} | {numItems} items, ₹{grandTotal}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.floatingHelpBtn} onPress={() => navigation.navigate('HelpSupport')}>
                <Text style={styles.floatingHelpText}>HELP</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.swiggyBottomCard}>
            <View style={styles.dragHandle} />

            <View style={styles.swiggyCardHeader}>
              <View style={styles.swiggyStatusIcon}>
                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/1008/1008010.png' }} style={{ width: 24, height: 24, tintColor: '#4B5563' }} />
                <View style={styles.swiggyStatusBadge}><Text style={styles.swiggyStatusBadgeText}>NOW</Text></View>
              </View>

              <View style={styles.swiggyStatusTextContainer}>
                <Text style={styles.swiggyStatusTitle}>{orderStatus}</Text>
                <Text style={styles.swiggyStatusSub}>
                  {order.driverName ? `${order.driverName} has picked up your order. Your items are en route!` : 'Preparing your order. Partner will be assigned soon.'}
                </Text>
                {order.driverPhone && (
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                    Phone: {order.driverPhone}
                  </Text>
                )}
              </View>

              {order.driverName && (
                <View style={styles.driverAvatarContainer}>
                  {order.driverPhoto ? (
                    <Image source={{ uri: order.driverPhoto }} style={styles.swiggyDriverAvatar} />
                  ) : (
                    <View style={[styles.swiggyDriverAvatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' }]}>
                      <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>
                        {order.driverName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.swiggyCallBtn} onPress={() => Linking.openURL(`tel:${order.driverPhone}`)}>
                    <Phone color="#FFF" size={14} fill="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', justifyContent: 'space-around' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MapPin color="#3B82F6" size={16} fill="#3B82F6" />
                <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 6, fontWeight: '500' }}>Pharmacy</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MapPin color="#F59E0B" size={16} fill="#F59E0B" />
                <Text style={{ fontSize: 13, color: '#6B7280', marginLeft: 6, fontWeight: '500' }}>Drop-off</Text>
              </View>
            </View>

            {['Driver Assigned', 'Picked Up', 'Out for Delivery'].includes(orderStatus) && (
              <View style={styles.swiggyOtpContainer}>
                <Text style={styles.swiggyOtpLabel}>Provide PIN to Delivery Agent</Text>
                <Text style={styles.swiggyOtpText}>{order.dropoffOtp || order.numericId || order.id.slice(-6).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Floating Reorder & Rate Buttons for Delivered Orders */}
      {isDelivered && (
        <View style={styles.floatingFooter}>
          {!hasRated && (
            <TouchableOpacity
              style={[styles.reorderLargeBtn, { backgroundColor: '#F59E0B', marginBottom: 12 }]}
              onPress={() => setShowRatingModal(true)}
            >
              <Text style={styles.reorderLargeText}>RATE ORDER</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.reorderLargeBtn} onPress={() => handleReorder(order.items)}>
            <Text style={styles.reorderLargeText}>REORDER</Text>
          </TouchableOpacity>
        </View>
      )}

      {order && (
        <RatingModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          onSubmit={handleRatingSubmit}
          pharmacyName={pharmacyDetails?.name || 'Pharmacy'}
          driverName={order.driverName}
          orderItems={order.items || []}
          initialPharmacyRating={order.serviceRating}
          initialDriverRating={order.deliveryRating}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  helpBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  helpBtnText: { color: '#EA580C', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.5 },

  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Historical UI Styles (Delivered)
  historicalWrapper: { backgroundColor: '#FFFFFF' },
  histTimeline: { padding: 20 },
  histRow: { flexDirection: 'row', alignItems: 'flex-start' },
  histTextContainer: { marginLeft: 16, flex: 1 },
  histTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  histSub: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  histDottedLine: { width: 2, height: 40, borderLeftWidth: 2, borderLeftColor: '#E5E7EB', borderStyle: 'dotted', marginLeft: 9, marginVertical: 4 },
  histSolidLine: { width: 2, height: 40, backgroundColor: '#E5E7EB', marginLeft: 9, marginVertical: 4 },
  onTimeBadge: { backgroundColor: '#8B5CF6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 8, alignSelf: 'center' },
  onTimeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },

  histDivider: { height: 8, backgroundColor: '#F3F4F6' },

  billDetailsContainer: { padding: 20, backgroundColor: '#FFFFFF' },
  billDetailsHeader: { fontSize: 14, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 16 },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  vegIcon: { width: 14, height: 14, borderWidth: 1, borderColor: '#059669', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' },
  billItemName: { fontSize: 15, color: '#374151' },
  billItemPrice: { fontSize: 15, color: '#374151', fontWeight: '500' },

  billBreakdown: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billRowLabel: { fontSize: 14, color: '#6B7280' },
  billRowVal: { fontSize: 14, color: '#4B5563' },

  billFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  billFooterMethod: { fontSize: 14, color: '#6B7280' },
  billFooterTotalLabel: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginRight: 12 },
  billFooterTotalVal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

  floatingFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  reorderLargeBtn: { backgroundColor: '#EA580C', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  reorderLargeText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  mainContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  floatingTopHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
  },
  floatingBackBtn: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  floatingOrderInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  floatingOrderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  floatingOrderSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  floatingHelpBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  floatingHelpText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EA580C',
  },

  customerMarker: {
    backgroundColor: '#111827',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  scooterMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaBubble: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  etaBubbleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  etaBubbleTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1F2937',
    alignSelf: 'center',
  },

  swiggyBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -5 },
    shadowRadius: 15,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  swiggyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  swiggyStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  swiggyStatusBadge: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  swiggyStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  swiggyStatusTextContainer: {
    flex: 1,
  },
  swiggyStatusTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  swiggyStatusSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  swiggyDelayNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  delayText: {
    fontSize: 12,
    color: '#4B5563',
  },
  driverAvatarContainer: {
    position: 'relative',
    marginLeft: 12,
  },
  swiggyDriverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
  },
  swiggyCallBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#EA580C',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  swiggyOtpContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swiggyOtpLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  swiggyOtpText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 2,
  }
});

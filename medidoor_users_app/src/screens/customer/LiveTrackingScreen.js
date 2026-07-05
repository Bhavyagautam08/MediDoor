import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Dimensions, Linking, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Phone, MessageSquare, Map as MapIcon, CheckCircle2, Circle, Clock, X, Maximize2, MapPin, Home, Navigation } from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
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
  const [eta, setEta] = useState(15);
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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setCustomerLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      } else {
        setCustomerLocation({ latitude: 28.5450, longitude: 77.3960 }); // Default fallback
      }
    })();
  }, []);

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
      navigation.navigate('CustomerRoot', { screen: 'Cart' });
    }
  };

  if (!order) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading your order...</Text>
      </View>
    );
  }

  // Standardized numeric order ID across all apps
  const shortOrderId = order.numericId || (orderId ? orderId.slice(-6).toUpperCase() : 'N/A');
  const orderStatus = order.status || 'Placed';
  const isDelivered = orderStatus === 'Delivered';
  const hasRated = order.serviceRating !== undefined || order.deliveryRating !== undefined;
  
  const handleRatingSubmit = async ({ rating, review, ratedDishes }) => {
    try {
      const orderRef = doc(db, 'orders', order.id);
      await setDoc(orderRef, {
        serviceRating: rating || 0,
        reviewText: review || '',
        ratedItems: ratedDishes || {}
      }, { merge: true });
      setShowRatingModal(false);
      // Optimistic state update (if needed, but onSnapshot should catch it)
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
    <SafeAreaView style={styles.safeArea}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginRight: 12 }}>
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          {isDelivered ? (
            <View>
              <Text style={styles.headerTitle}>ORDER #{shortOrderId}</Text>
              <Text style={styles.headerSubtitle}>Delivered , {numItems} Item{numItems > 1 ? 's' : ''} , ₹{grandTotal}</Text>
            </View>
          ) : (
            <View style={{ justifyContent: 'center', height: 32 }}>
              <Text style={styles.headerTitle}>Order Summary</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>HELP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: isDelivered ? 100 : 40 }}>
        
        {isDelivered ? (
          /* ================= DELIVERED UI (Historical View) ================= */
          <View style={styles.historicalWrapper}>
            {/* Timeline */}
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

            {/* In-Depth Bill Details */}
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
        ) : (
          /* ================= ACTIVE ORDER UI (Live Tracking View) ================= */
          <View style={[styles.mainCard, { marginHorizontal: 16, marginTop: 16 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderIdText}>Order #{shortOrderId}</Text>
              <View style={styles.statusBadgeLive}>
                <Text style={styles.statusBadgeTextLive}>{orderStatus}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.mapWrapper} activeOpacity={0.8} onPress={() => setIsMapExpanded(true)}>
              {customerLocation ? (
                <>
                  <MapView
                    style={styles.miniMap}
                    initialRegion={{
                      latitude: (customerLocation.latitude + (pharmacyCoords?.latitude || customerLocation.latitude)) / 2,
                      longitude: (customerLocation.longitude + (pharmacyCoords?.longitude || customerLocation.longitude)) / 2,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }}
                    scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
                  >
                    <Marker coordinate={customerLocation} title="Your Home" pinColor="#10B981" />
                    {pharmacyCoords && <Marker coordinate={pharmacyCoords} title="Pharmacy" pinColor="#3B82F6" />}
                    
                    {pharmacyCoords && customerLocation && GOOGLE_MAPS_APIKEY && (
                      <MapViewDirections 
                        origin={pharmacyCoords} 
                        destination={customerLocation} 
                        apikey={GOOGLE_MAPS_APIKEY} 
                        strokeWidth={3} 
                        strokeColor="#9CA3AF"
                        lineDashPattern={[5, 5]} 
                      />
                    )}
                    
                    {order.riderLocation && GOOGLE_MAPS_APIKEY && (
                      <MapViewDirections 
                        origin={order.riderLocation} 
                        destination={['Picked Up', 'Out for Delivery'].includes(orderStatus) ? customerLocation : pharmacyCoords} 
                        apikey={GOOGLE_MAPS_APIKEY} 
                        strokeWidth={4} 
                        strokeColor="#3B82F6" 
                        onReady={(result) => setEta(Math.ceil(result.duration))}
                      />
                    )}
                    {!order.riderLocation && pharmacyCoords && customerLocation && GOOGLE_MAPS_APIKEY && (
                      <MapViewDirections origin={pharmacyCoords} destination={customerLocation} apikey={GOOGLE_MAPS_APIKEY} strokeWidth={4} strokeColor="#3B82F6" onReady={(result) => setEta(Math.ceil(result.duration))} />
                    )}

                    {order.riderLocation && (
                      <Marker 
                        coordinate={order.riderLocation} 
                        title="Delivery Agent" 
                        flat={true} 
                        rotation={order.riderLocation.heading || 0}
                        anchor={{x: 0.5, y: 0.5}}
                        zIndex={999}
                      >
                        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: {width: 0, height: 2}, shadowRadius: 4 }}>
                          <View style={{ backgroundColor: '#10B981', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', transform: [{rotate: '45deg'}] }}>
                              <Navigation color="#fff" size={14} fill="#fff" />
                          </View>
                        </View>
                      </Marker>
                    )}
                  </MapView>
                  <View style={styles.expandMapIconContainer}><Maximize2 color="#111827" size={16} /></View>
                </>
              ) : (
                <View style={styles.mapPlaceholder}><MapIcon color="#9CA3AF" size={32} /><Text style={styles.mapPlaceholderText}>Live map coming soon</Text></View>
              )}
            </TouchableOpacity>

            <View style={styles.etaBanner}>
              <Clock color="#059669" size={18} />
              <Text style={styles.etaText}>Arriving in ~{order.etaMins || eta} minutes</Text>
            </View>

            {pharmacyDetails && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>🏥</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Preparing Your Order At</Text>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#111827', marginTop: 2 }}>{pharmacyDetails.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }} numberOfLines={1}>{pharmacyDetails.address}</Text>
                </View>
              </View>
            )}

            {orderStatus !== 'Placed' && (
              <View style={styles.driverBox}>
                {order.driverName ? (
                  <>
                    <View style={styles.driverAvatar}>
                      <Text style={{ fontSize: 20, color: '#fff' }}>{order.driverName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName} numberOfLines={1} adjustsFontSizeToFit>{order.driverName}</Text>
                      <Text style={styles.driverRole}>{order.driverRating || '4.9'} • Delivery partner</Text>
                    </View>
                    <View style={styles.driverActions}>
                      <TouchableOpacity 
                        style={styles.actionBtnSecondary}
                        onPress={() => {
                          if(order.driverPhone) Linking.openURL(`sms:${order.driverPhone}`);
                        }}
                      >
                        <MessageSquare color="#4B5563" size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionBtnPrimary}
                        onPress={() => {
                          if(order.driverPhone) Linking.openURL(`tel:${order.driverPhone}`);
                        }}
                      >
                        <Phone color="#FFFFFF" size={18} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.driverAvatar, { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                      <ActivityIndicator size="small" color="#9CA3AF" />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>Assigning partner...</Text>
                      <Text style={styles.driverRole}>Looking for nearby riders</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {['Driver Assigned', 'Picked Up', 'Out for Delivery'].includes(orderStatus) && (
              <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#047857', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>Provide PIN to Delivery Agent</Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: '#065F46', letterSpacing: 8, marginTop: 4 }}>
                  {order.dropoffOtp || order.numericId || order.id.slice(-6).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.timelineSection}>
              <View style={styles.timelineRow}><View style={styles.timelineIconContainer}><CheckCircle2 color="#00C853" size={20} /><View style={[styles.timelineLine, currentStep >= 2 && styles.timelineLineActive]} /></View><View style={styles.timelineContent}><Text style={styles.timelineTitleActive}>Order placed</Text><Text style={styles.timelineTime}>{timeString}</Text></View></View>
              <View style={styles.timelineRow}><View style={styles.timelineIconContainer}>{currentStep >= 2 ? <CheckCircle2 color="#00C853" size={20} /> : <Circle color="#D1D5DB" size={20} />}<View style={[styles.timelineLine, currentStep >= 3 && styles.timelineLineActive]} /></View><View style={styles.timelineContent}><Text style={currentStep >= 2 ? styles.timelineTitleActive : styles.timelineTitleInactive}>Confirmed and preparing</Text><Text style={styles.timelineTime}>{currentStep >= 2 ? timeString : 'Pending'}</Text></View></View>
              <View style={styles.timelineRow}><View style={styles.timelineIconContainer}>{currentStep >= 3 ? <CheckCircle2 color="#00C853" size={20} /> : <Circle color="#D1D5DB" size={20} />}<View style={[styles.timelineLine, currentStep >= 4 && styles.timelineLineActive]} /></View><View style={styles.timelineContent}><Text style={currentStep >= 3 ? styles.timelineTitleActive : styles.timelineTitleInactive}>Ready for pickup</Text><Text style={styles.timelineTime}>{currentStep >= 3 ? 'Awaiting driver' : 'Pending'}</Text></View></View>
              <View style={styles.timelineRow}><View style={styles.timelineIconContainer}>{currentStep >= 4 ? <CheckCircle2 color="#00C853" size={20} /> : <Circle color="#D1D5DB" size={20} />}<View style={[styles.timelineLine, currentStep >= 5 && styles.timelineLineActive]} /></View><View style={styles.timelineContent}><Text style={currentStep >= 4 ? styles.timelineTitleActive : styles.timelineTitleInactive}>Driver reached shop</Text><Text style={styles.timelineTime}>{currentStep >= 4 ? 'Package picked up' : 'Pending'}</Text></View></View>
              <View style={styles.timelineRow}><View style={styles.timelineIconContainer}>{currentStep >= 5 ? <CheckCircle2 color="#00C853" size={20} /> : <Circle color="#D1D5DB" size={20} />}<View style={[styles.timelineLine, currentStep >= 6 && styles.timelineLineActive]} /></View><View style={styles.timelineContent}><Text style={currentStep >= 5 ? styles.timelineTitleActive : styles.timelineTitleInactive}>Coming towards home</Text><Text style={styles.timelineTime}>{currentStep >= 5 ? 'On the way' : 'Pending'}</Text></View></View>
              <View style={[styles.timelineRow, { marginBottom: 0 }]}><View style={styles.timelineIconContainer}>{currentStep >= 6 ? <CheckCircle2 color="#00C853" size={20} /> : <Circle color="#D1D5DB" size={20} />}</View><View style={styles.timelineContent}><Text style={currentStep >= 6 ? styles.timelineTitleActive : styles.timelineTitleInactive}>Delivered</Text><Text style={styles.timelineTime}>{currentStep >= 6 ? 'Completed' : 'Pending'}</Text></View></View>
            </View>

            <View style={styles.orderDetailsSection}>
              <View style={styles.receiptHeader}>
                 <Text style={styles.orderDetailsTitle}>Order Details</Text>
                 <Text style={styles.receiptOrderId}>{shortOrderId}</Text>
              </View>
              <View style={styles.receiptDividerDashed} />
              
              {order.items && order.items.map((item, index) => (
                <View key={index} style={styles.orderItemRow}>
                  <View style={styles.orderItemLeft}>
                     <Text style={styles.orderItemText}>{item.qty}x {item.name || 'Prescription Medicines'}</Text>
                  </View>
                  <Text style={styles.orderItemPrice}>₹{(item.price * item.qty).toFixed(2)}</Text>
                </View>
              ))}
              
              <View style={styles.receiptDividerDashed} />
              
              <View style={styles.orderItemRow}><Text style={styles.orderTotalValue}>Subtotal</Text><Text style={styles.orderTotalValue}>₹{subtotal.toFixed(2)}</Text></View>
              <View style={styles.orderItemRow}><Text style={styles.orderTotalValue}>Delivery Charge</Text><Text style={styles.orderTotalValue}>₹{deliveryFee.toFixed(2)}</Text></View>
              <View style={styles.orderItemRow}><Text style={styles.orderTotalValue}>Service Fee</Text><Text style={styles.orderTotalValue}>₹{serviceFee.toFixed(2)}</Text></View>
              
              <View style={styles.receiptDividerSolid} />
              
              <View style={styles.orderItemRow}><Text style={styles.receiptTotalText}>Total</Text><Text style={styles.receiptTotalPrice}>₹{grandTotal.toFixed(2)}</Text></View>
              
              <View style={styles.receiptFooter}>
                <Text style={styles.receiptFooterText}>Paid via {order.paymentMethod === 'online' ? 'Online' : 'Cash on Delivery'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

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
          pharmacyName={order.pharmacyName}
          driverName={order.driverName}
          orderItems={order.items || []}
        />
      )}

      {/* Full-Screen Map Modal */}
      {!isDelivered && (
        <Modal visible={isMapExpanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsMapExpanded(false)}>
          <View style={styles.fullScreenMapContainer}>
            <TouchableOpacity style={styles.closeMapBtn} onPress={() => setIsMapExpanded(false)}><X color="#111827" size={24} /></TouchableOpacity>
            {customerLocation && (
              <MapView style={styles.fullScreenMap} initialRegion={{ latitude: (customerLocation.latitude + (pharmacyCoords?.latitude || customerLocation.latitude)) / 2, longitude: (customerLocation.longitude + (pharmacyCoords?.longitude || customerLocation.longitude)) / 2, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
                <Marker coordinate={customerLocation} title="Your Location" pinColor="#10B981" />
                {pharmacyCoords && <Marker coordinate={pharmacyCoords} title="Pharmacy" pinColor="#3B82F6" />}
                
                {pharmacyCoords && customerLocation && GOOGLE_MAPS_APIKEY && <MapViewDirections origin={pharmacyCoords} destination={customerLocation} apikey={GOOGLE_MAPS_APIKEY} strokeWidth={3} strokeColor="#9CA3AF" lineDashPattern={[5, 5]} />}
                
                {order.riderLocation && GOOGLE_MAPS_APIKEY && (
                  <MapViewDirections 
                    origin={order.riderLocation} 
                    destination={['Picked Up', 'Out for Delivery'].includes(orderStatus) ? customerLocation : pharmacyCoords} 
                    apikey={GOOGLE_MAPS_APIKEY} strokeWidth={4} strokeColor="#3B82F6" 
                  />
                )}
                {!order.riderLocation && pharmacyCoords && customerLocation && GOOGLE_MAPS_APIKEY && (
                  <MapViewDirections origin={pharmacyCoords} destination={customerLocation} apikey={GOOGLE_MAPS_APIKEY} strokeWidth={4} strokeColor="#3B82F6" />
                )}

                {order.riderLocation && (
                  <Marker coordinate={order.riderLocation} title="Delivery Agent" flat={true} rotation={order.riderLocation.heading || 0} anchor={{x: 0.5, y: 0.5}} zIndex={999}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: {width: 0, height: 3}, shadowRadius: 5 }}>
                      <View style={{ backgroundColor: '#10B981', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', transform: [{rotate: '45deg'}] }}>
                          <Navigation color="#fff" size={16} fill="#fff" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>
            )}
          </View>
        </Modal>
      )}

    </SafeAreaView>
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

  // Live Tracking UI Styles
  mainCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  orderIdText: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  statusBadgeLive: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusBadgeTextLive: { color: '#1E3A8A', fontWeight: 'bold', fontSize: 12 },

  mapWrapper: { height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  miniMap: { flex: 1 },
  expandMapIconContainer: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#FFFFFF', padding: 8, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { color: '#6B7280', marginTop: 8, fontSize: 14 },
  
  fullScreenMapContainer: { flex: 1, backgroundColor: '#fff' },
  fullScreenMap: { width: '100%', height: '100%' },
  closeMapBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },

  etaBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#D1FAE5' },
  etaText: { color: '#065F46', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },

  driverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, marginBottom: 24 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  driverRole: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  driverActions: { flexDirection: 'row', gap: 8 },
  actionBtnSecondary: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  actionBtnPrimary: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#00C853', justifyContent: 'center', alignItems: 'center' },

  timelineSection: { marginVertical: 12 },
  timelineRow: { flexDirection: 'row', marginBottom: 24 },
  timelineIconContainer: { alignItems: 'center', width: 24, marginRight: 16 },
  timelineLine: { width: 2, height: 30, backgroundColor: '#E5E7EB', marginTop: 4, position: 'absolute', top: 20 },
  timelineLineActive: { backgroundColor: '#00C853' },
  timelineContent: { flex: 1, paddingTop: 2 },
  timelineTitleActive: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  timelineTitleInactive: { fontSize: 15, fontWeight: '500', color: '#9CA3AF' },
  timelineTime: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  orderDetailsSection: { marginTop: 24, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderDetailsTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 },
  receiptOrderId: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  receiptDividerDashed: { height: 1, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 16, borderRadius: 1 },
  receiptDividerSolid: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  orderItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  orderItemText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  orderItemPrice: { fontSize: 14, fontWeight: '600', color: '#111827' },
  orderTotalValue: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  receiptTotalText: { fontSize: 16, fontWeight: '800', color: '#111827', textTransform: 'uppercase' },
  receiptTotalPrice: { fontSize: 20, fontWeight: '900', color: '#00C853' },
  receiptFooter: { marginTop: 12, alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8 },
  receiptFooterText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Modal, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, CreditCard, CheckCircle, UploadCloud, RefreshCw, ChevronRight, ChevronLeft, Navigation, FileText, RefreshCcw, ShieldCheck, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { clearCart } from '../../store/slices/cartSlice';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db, auth, app } from '../../firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';

export default function CheckoutScreen({ route, navigation }) {
  const quoteData = route?.params?.quoteData || null;
  const requestId = route?.params?.requestId || null;
  const cartBilling = route?.params?.cartBilling || null;
  const dispatch = useDispatch();
  const { totalAmount, items: cartItems } = useSelector(state => state.cart);
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [subscribeRefill, setSubscribeRefill] = useState(false);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [isSubscriptionFeatureEnabled, setIsSubscriptionFeatureEnabled] = useState(false);

  const [deliveryCharge, setDeliveryCharge] = useState(quoteData ? quoteData.deliveryFee : (cartBilling ? cartBilling.deliveryFee : 0));
  const [distanceKm, setDistanceKm] = useState(0);
  const [etaMins, setEtaMins] = useState(cartBilling ? cartBilling.etaMins : 0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [customerCoords, setCustomerCoords] = useState(null);
  const [pharmacyCoords, setPharmacyCoords] = useState(null);

  // Use the exact bill provided by the Cart or Quote
  const serviceFee = quoteData ? 15 : (cartBilling ? (cartBilling.serviceFee || 15) : 15);
  const finalTotal = quoteData ? quoteData.totalAmount : (cartBilling ? cartBilling.total : (totalAmount + deliveryCharge + serviceFee));
  const medicinesTotal = quoteData ? quoteData.medicinesPrice : (cartBilling ? cartBilling.subtotal : totalAmount);

  let itemsList = [];
  if (quoteData) {
    itemsList = [{ id: 'prescription_quote', name: 'Prescription Medicines', price: Number(quoteData.medicinesPrice) || 0, qty: 1, reqRx: true }];
  } else {
    itemsList = cartItems.map(i => ({
      id: i.medicine?.id || 'unknown',
      name: i.medicine?.name || 'Medicine',
      price: Number(i.medicine?.price) || 0,
      qty: Number(i.quantity) || 1,
      reqRx: !!i.medicine?.requiresPrescription
    }));
  }

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [placedOrderDocId, setPlacedOrderDocId] = useState(null);
  const [placedOrderNumericId, setPlacedOrderNumericId] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showSuccessModal) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [showSuccessModal, scaleAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'customers', currentUser.uid));
        if (userDoc.exists() && userDoc.data().addresses) {
          const addrs = userDoc.data().addresses;
          const defaultAddr = addrs.find(a => a.isDefault) || addrs[0];
          if (defaultAddr) {
            setAddress(defaultAddr.text);

            // Fetch Pharmacy coordinates
            const pharmacyId = quoteData ? quoteData.pharmacyId : cartItems[0]?.medicine?.pharmacyId;
            if (pharmacyId && defaultAddr.latitude && defaultAddr.longitude && medicinesTotal > 0) {
              setIsCalculatingFee(true);
              const pDoc = await getDoc(doc(db, 'pharmacies', pharmacyId));
              if (pDoc.exists()) {
                const pLat = pDoc.data().latitude;
                const pLng = pDoc.data().longitude;
                if (pLat && pLng) {
                  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
                  const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pLat},${pLng}&destinations=${defaultAddr.latitude},${defaultAddr.longitude}&key=${API_KEY}`);
                  const data = await res.json();

                  if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
                    const distValue = data.rows[0].elements[0].distance.value; // in meters
                    const durValue = data.rows[0].elements[0].duration.value; // in seconds

                    const distKm = distValue / 1000;
                    setDistanceKm(distKm);
                    if (!cartBilling) setEtaMins(Math.ceil(durValue / 60));

                    // Fee formula only calculated if NOT using a pre-calculated quote AND NOT using cart billing
                    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'app_features'));
        if (settingsDoc.exists() && settingsDoc.data().enableSubscriptions === true) {
          setIsSubscriptionFeatureEnabled(true);
        }
      } catch (err) {
        console.log("Failed to fetch admin settings:", err);
      }
      
      if (!quoteData && !cartBilling) {
                      let calcFee = 35;
                      if (distKm <= 2) calcFee = 35;
                      else if (distKm <= 4) calcFee = 45;
                      else if (distKm <= 6) calcFee = 55;
                      else if (distKm <= 8) calcFee = 65;
                      else if (distKm <= 10) calcFee = 75;
                      else if (distKm <= 12) calcFee = 90;
                      else if (distKm <= 14) calcFee = 105;
                      else if (distKm <= 16) calcFee = 120;
                      else calcFee = 135;
                      
                      setDeliveryCharge(calcFee);
                    }

                    // Save coordinates in state to pass to order
                    setCustomerCoords({ latitude: defaultAddr.latitude, longitude: defaultAddr.longitude });
                    setPharmacyCoords({ latitude: pLat, longitude: pLng });
                  } else {
                    console.warn("Maps API Error:", data.status, data.error_message || "No error message provided");
                    if (!quoteData && !cartBilling) setDeliveryCharge(medicinesTotal > 0 ? 50 : 0);
                  }
                }
              }
              setIsCalculatingFee(false);
            } else {
              if (!quoteData && !cartBilling) setDeliveryCharge(medicinesTotal > 0 ? 40 : 0);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching address/fee:", err);
        setIsCalculatingFee(false);
      } finally {
        setFetchingAddress(false);
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      Alert.alert('Address Required', 'Please enter your delivery address');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Authentication Error', 'You must be logged in to place an order.');
      return;
    }

    // Robust Algorithm to guarantee a purely numeric, 8-digit Order ID
    const uniqueNumericId = Math.floor(10000000 + Math.random() * 90000000).toString();

    // For UPI/Online — go to payment screen first
    if (paymentMethod === 'online') {
      setIsPlacingOrder(true);
      try {
        // Create the pending order in Firestore first
        const docRefId = await placeOrderInFirestore(currentUser, null, uniqueNumericId, true);
        
        // Call PhonePe Cloud Function directly via REST API to bypass Firebase SDK issues
        const response = await fetch('https://us-central1-medidoor-f8af9.cloudfunctions.net/initPhonePeOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              orderId: uniqueNumericId,
              amount: finalTotal,
              userId: currentUser.uid
            }
          })
        });

        if (!response.ok) {
           throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        const responseData = jsonResponse.data || {};
        
        setIsPlacingOrder(false);
        if (responseData && responseData.paymentLink) {
           navigation.navigate('UpiPayment', {
             paymentLink: responseData.paymentLink,
             orderDocId: docRefId,
             numericId: uniqueNumericId
           });
        }
      } catch (err) {
        console.error("Payment Init Error:", err);
        Alert.alert("Payment Error", "Could not initialize secure payment. Please try again or use COD.");
        setIsPlacingOrder(false);
      }
      return;
    }

    // COD — place immediately
    await placeOrderInFirestore(currentUser, null, uniqueNumericId, false);
  };

  const placeOrderInFirestore = async (currentUser, razorpayPaymentId, providedNumericId, isOnlinePending = false) => {
    setIsPlacingOrder(true);
    try {
      // Push the order to Firebase Firestore
      const pharmacyId = quoteData ? quoteData.pharmacyId : (cartItems[0]?.medicine?.pharmacyId || null);

      const uniqueNumericId = providedNumericId || Math.floor(10000000 + Math.random() * 90000000).toString();

      const orderData = {
        userId: currentUser?.uid || 'unknown',
        numericId: uniqueNumericId || '000000',
        address: address || '',
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: razorpayPaymentId ? 'paid' : 'pending',
        razorpayPaymentId: razorpayPaymentId || null,
        subtotal: Number(medicinesTotal) || 0,
        totalAmount: Number(finalTotal) || 0,
        deliveryFee: Number(deliveryCharge) || 0,
        serviceFee: Number(serviceFee) || 0,
        items: itemsList || [],
        status: 'Placed', // Send to Pharmacy's "New" tab
        createdAt: new Date().toISOString(),
        pickupOtp: Math.floor(100000 + Math.random() * 900000).toString(),
        dropoffOtp: Math.floor(100000 + Math.random() * 900000).toString(),
        prescriptionUrl: prescriptionUrl || null,
        prescriptionRequestId: requestId || null,
        subscribeRefill: subscribeRefill || false,
        pharmacyId: pharmacyId || null,
        etaMins: Number(etaMins) || 0,
        customerLocation: customerCoords || null,
        pharmacyLocation: pharmacyCoords || null
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);

      dispatch(clearCart());
      setIsPlacingOrder(false);

      if (!isOnlinePending) {
        setPlacedOrderDocId(docRef.id);
        setPlacedOrderNumericId(uniqueNumericId);
        setShowSuccessModal(true);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error placing order:', error);
      setIsPlacingOrder(false);
      Alert.alert('Detailed Error', String(error.message || error));
      throw error;
    }
  };

  const handleUploadPrescription = async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setIsUploading(true);
        // Simulate upload delay
        setTimeout(() => {
          setPrescriptionUrl(result.assets[0].uri);
          setPrescriptionUploaded(true);
          setIsUploading(false);
          Alert.alert('Success', 'Prescription uploaded!');
        }, 1000);
      }
    } catch (error) {
      console.error(error); Alert.alert("Error", String(error || "An unexpected error occurred"));
      Alert.alert('Error', 'Failed to pick image.');
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderTitle}>
              <MapPin color="#00C853" size={20} />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Addresses')}>
              <Text style={styles.changeAddressText}>Change</Text>
            </TouchableOpacity>
          </View>

          {fetchingAddress ? (
            <Text style={styles.loadingAddressText}>Loading address...</Text>
          ) : address ? (
            <TouchableOpacity style={styles.addressDisplayBox} onPress={() => navigation.navigate('Addresses')}>
              <Text style={styles.addressDisplayText}>{address}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.addAddressBtn} onPress={() => navigation.navigate('Addresses')}>
              <Text style={styles.addAddressText}>+ Add Delivery Address</Text>
            </TouchableOpacity>
          )}
        </View>

        {!quoteData && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UploadCloud color="#2563EB" size={20} />
              <Text style={styles.sectionTitle}>Prescription Upload</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Optional: Attach an Rx if you have one.</Text>
            <TouchableOpacity
              style={[styles.uploadBox, prescriptionUploaded && styles.uploadBoxSuccess]}
              onPress={handleUploadPrescription}
              disabled={isUploading || prescriptionUploaded}
            >
              <UploadCloud color={prescriptionUploaded ? "#059669" : "#6B7280"} size={24} style={{ marginBottom: 8 }} />
              <Text style={[styles.uploadText, prescriptionUploaded && { color: '#059669', fontWeight: 'bold' }]}>
                {isUploading ? "Uploading image..." : prescriptionUploaded ? "Prescription Attached.jpg" : "Tap to upload photo"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isSubscriptionFeatureEnabled && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <RefreshCw color="#9333EA" size={20} />
              <Text style={styles.sectionTitle}>Monthly Refill Subscription</Text>
            </View>
            <View style={styles.refillRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.refillTitle}>Subscribe & Save 10%</Text>
                <Text style={styles.refillDesc}>Auto-deliver these medicines every 30 days.</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleBtn, subscribeRefill && styles.toggleBtnActive]}
                onPress={() => setSubscribeRefill(!subscribeRefill)}
              >
                <View style={[styles.toggleKnob, subscribeRefill && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard color="#00C853" size={20} />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentSelected]}
            onPress={() => setPaymentMethod('cod')}
          >
            <View style={styles.paymentRadio}>
              {paymentMethod === 'cod' && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.paymentText}>💵  Cash on Delivery</Text>
            <CheckCircle color={paymentMethod === 'cod' ? '#00C853' : '#E5E7EB'} size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'online' && styles.paymentSelected]}
            onPress={() => setPaymentMethod('online')}
          >
            <View style={styles.paymentRadio}>
              {paymentMethod === 'online' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentText}>💳  UPI / Card / Wallet</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Powered by Razorpay • Secure Checkout</Text>
            </View>
            <CheckCircle color={paymentMethod === 'online' ? '#00C853' : '#E5E7EB'} size={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showBillDetails && (
        <ScrollView style={styles.expandedBillBox} showsVerticalScrollIndicator={false}>
          <View style={styles.billBreakdownHeader}>
             <Text style={styles.billBreakdownTitle}>BILL DETAILS</Text>
          </View>
          
          <View style={styles.billBody}>
            <View style={styles.billItemsContainer}>
              {itemsList.map((item, index) => (
                <View key={index} style={styles.billItemRow}>
                  <View style={styles.billItemLeft}>
                    <Text style={styles.billItemName}>{item.name}</Text>
                    <Text style={styles.billItemQty}> x {item.qty}</Text>
                  </View>
                  <Text style={styles.billItemPrice}>₹{(item.price * item.qty).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.billDividerSolid} />

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Medicine Cost</Text>
              <Text style={styles.billValue}>₹{medicinesTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Charge</Text>
              {isCalculatingFee ? (
                <ActivityIndicator size="small" color="#00C853" />
              ) : (
                <Text style={styles.billValue}>₹{deliveryCharge.toFixed(2)}</Text>
              )}
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Service Fee</Text>
              <Text style={styles.billValue}>₹{serviceFee.toFixed(2)}</Text>
            </View>
            
            <View style={styles.billDividerSolid} />
            
            <View style={styles.billRow}>
              <Text style={styles.billTotalLabel}>Bill Total</Text>
              <Text style={styles.billTotalValue}>₹{finalTotal.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[styles.footer, showBillDetails && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
        <TouchableOpacity style={styles.footerLeft} onPress={() => setShowBillDetails(!showBillDetails)} activeOpacity={0.7}>
          <Text style={styles.footerTotalAmount}>₹{finalTotal.toFixed(2)}</Text>
          <View style={styles.viewBillBtn}>
            <Text style={styles.viewBillText}>View detailed bill</Text>
            {showBillDetails ? <ChevronDown color="#00C853" size={16} /> : <ChevronUp color="#00C853" size={16} />}
          </View>
          {etaMins > 0 && !isCalculatingFee && (
             <Text style={styles.etaSubtext}>Arriving in {etaMins} mins</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.placeOrderButton, isPlacingOrder && { opacity: 0.7 }]} onPress={handlePlaceOrder} disabled={isPlacingOrder}>
          <Text style={styles.placeOrderText}>{isPlacingOrder ? 'Processing...' : 'Place Order'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successModalCard, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.successIconWrap}>
              <CheckCircle color="#FFFFFF" size={44} strokeWidth={3} />
            </View>
            <Text style={styles.successModalTitle}>Order Confirmed!</Text>
            <Text style={styles.successModalDesc}>Your order #{placedOrderNumericId} has been successfully placed and routed to the pharmacy.</Text>
            
            <TouchableOpacity 
              style={styles.trackOrderBtn}
              onPress={() => {
                setShowSuccessModal(false);
                dispatch(clearCart());
                navigation.replace('LiveTracking', { orderId: placedOrderDocId });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.trackOrderBtnText}>Track My Order</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },
  content: { flex: 1, padding: 16 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeaderTitle: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginLeft: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  changeAddressText: { color: '#00C853', fontWeight: 'bold', fontSize: 14 },
  loadingAddressText: { color: '#6B7280', fontSize: 14 },
  addressDisplayBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  addressDisplayText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  addAddressBtn: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB' },
  addAddressText: { color: '#4B5563', fontWeight: 'bold', fontSize: 14 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  uploadBox: { borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', backgroundColor: '#F9FAFB' },
  uploadBoxSuccess: { borderColor: '#10B981', backgroundColor: '#ECFDF5', borderStyle: 'solid' },
  uploadText: { fontSize: 14, color: '#4B5563', marginTop: 8 },
  refillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refillTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  refillDesc: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  toggleBtn: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', padding: 2, justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: '#9333EA' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  toggleKnobActive: { transform: [{ translateX: 20 }] },
  paymentOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  paymentSelected: { borderColor: '#00C853', backgroundColor: '#F0FDF4', borderWidth: 2 },
  paymentRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#00C853', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00C853' },
  paymentText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  
  expandedBillBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', maxHeight: 400 },
  billBreakdownHeader: { backgroundColor: '#F9FAFB', paddingHorizontal: 20, paddingVertical: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  billBreakdownTitle: { fontSize: 13, fontWeight: '800', color: '#6B7280', letterSpacing: 1 },
  billBody: { paddingHorizontal: 20, paddingVertical: 16 },
  billItemsContainer: { paddingBottom: 8 },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  billItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  billItemName: { fontSize: 15, color: '#374151', fontWeight: '500' },
  billItemQty: { fontSize: 15, color: '#6B7280' },
  billItemPrice: { fontSize: 15, color: '#374151', fontWeight: '500' },
  billDividerSolid: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 14, color: '#6B7280' },
  billValue: { fontSize: 14, color: '#374151', fontWeight: '500' },
  billTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  billTotalValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  
  footer: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  footerLeft: { flex: 1, justifyContent: 'center' },
  footerTotalAmount: { fontSize: 22, fontWeight: '900', color: '#111827' },
  viewBillBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  viewBillText: { fontSize: 13, fontWeight: '700', color: '#00C853', marginRight: 4 },
  etaSubtext: { fontSize: 12, color: '#00C853', fontWeight: 'bold', marginTop: 4 },
  placeOrderButton: { backgroundColor: '#00C853', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', shadowColor: '#00C853', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  placeOrderText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successModalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  successModalTitle: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 12 },
  successModalDesc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 10 },
  trackOrderBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center' },
  trackOrderBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 }
});

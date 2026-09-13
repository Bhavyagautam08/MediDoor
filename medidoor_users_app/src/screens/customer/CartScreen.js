import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Store, Plus, Minus, Info, Zap, Clock, CheckCircle, Circle } from 'lucide-react-native';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { addToCart, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export default function CartScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items: cartItems, totalAmount } = useSelector(state => state.cart, shallowEqual);

  const [deliveryType, setDeliveryType] = useState('standard'); // 'standard' | 'fast'
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const sDoc = await getDoc(doc(db, 'settings', 'app_features'));
        if (sDoc.exists()) setGlobalSettings(sDoc.data());
      } catch (err) {}
    };
    fetchSettings();
  }, []);

  const itemsByPharmacy = cartItems.reduce((acc, item) => {
    const pId = item.medicine.pharmacyId || 'unknown';
    if (!acc[pId]) {
      acc[pId] = {
        pharmacyName: item.medicine.pharmacyObj?.name || 'Axoro Partner Pharmacy',
        distance: item.medicine.pharmacyObj?.numericDist || 2,
        storeDiscount: item.medicine.pharmacyObj?.storeDiscount ? Number(item.medicine.pharmacyObj.storeDiscount) : 0,
        items: []
      };
    }
    acc[pId].items.push(item);
    return acc;
  }, {});

  const numStores = Object.keys(itemsByPharmacy).length;

  let totalStandardFee = 0;
  let maxDistance = 0;
  let totalDiscount = 0;

  Object.values(itemsByPharmacy).forEach(group => {
    let dist = group.distance || 0;
    
    // Calculate discount for this store
    let storeSubtotal = group.items.reduce((sum, i) => sum + (i.medicine.price * i.quantity), 0);
    if (group.storeDiscount > 0) {
      totalDiscount += storeSubtotal * (group.storeDiscount / 100);
    }

    let fee = 35;
    if (dist <= 2) fee = 35;
    else if (dist <= 4) fee = 45;
    else if (dist <= 6) fee = 55;
    else if (dist <= 8) fee = 65;
    else if (dist <= 10) fee = 75;
    else if (dist <= 12) fee = 90;
    else if (dist <= 14) fee = 105;
    else if (dist <= 16) fee = 120;
    else fee = 135;
    
    const baseDFee = Number(globalSettings?.baseDeliveryFee) || 0;
    if (fee < baseDFee) fee = baseDFee;
    
    totalStandardFee += fee;
    
    if (dist > maxDistance) {
      maxDistance = dist;
    }
  });

  const deliveryCharge = totalAmount > 0 ? totalStandardFee : 0;
  const serviceFee = totalAmount > 0 ? (Number(globalSettings?.customerServiceFee) || 15) : 0;
  const finalTotal = totalAmount - totalDiscount + deliveryCharge + serviceFee;

  // Dynamic ETA Calculation (Indian Micro-logistics Model)
  const baseStdTime = Math.ceil(10 + (maxDistance * 5) + ((numStores - 1) * 10));
  const stdEtaString = `${Math.max(10, baseStdTime - 5)} - ${baseStdTime + 10} mins`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#212121" size={24} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <View style={{ width: 24 }} />
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyCartContainer}>
          <Text style={styles.emptyCartText}>Your cart is empty.</Text>
          <TouchableOpacity style={styles.continueBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.continueBtnText}>Browse Medicines</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {Object.entries(itemsByPharmacy).map(([pId, group]) => (
              <View key={pId} style={styles.pharmacyGroup}>
                <View style={styles.pharmacyHeader}>
                  <Store color="#003366" size={18} />
                  <Text style={styles.pharmacyName}>{group.pharmacyName}</Text>
                </View>

                {group.items.map((item, index) => (
                  <View key={item.medicine.id + index} style={styles.itemCard}>
                    <Image source={{ uri: item.medicine.imgUrl }} style={styles.itemImage} />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.medicine.name}</Text>
                      <Text style={styles.itemPrice}>₹{(item.medicine.price * item.quantity).toFixed(2)}</Text>
                    </View>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity onPress={() => dispatch(removeFromCart(item.medicine.id))}>
                        <Minus color="#757575" size={20} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => dispatch(addToCart(item.medicine))}>
                        <Plus color="#0D9494" size={20} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Billing Summary</Text>
              
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Medicine Cost</Text><Text style={styles.summaryValue}>₹{totalAmount.toFixed(2)}</Text></View>
              
              {totalDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#0D9494' }]}>Store Discounts</Text>
                  <Text style={[styles.summaryValue, { color: '#0D9494' }]}>-₹{totalDiscount.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Charge</Text>
                <Text style={styles.summaryValue}>₹{deliveryCharge.toFixed(2)}</Text>
              </View>
              
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Service Fee</Text><Text style={styles.summaryValue}>₹{serviceFee.toFixed(2)}</Text></View>
              
              <View style={styles.dashedDivider} />

              <View style={[styles.summaryRow, { marginTop: 8 }]}><Text style={styles.summaryTotalLabel}>To Pay</Text><Text style={styles.summaryTotalValue}>₹{finalTotal.toFixed(2)}</Text></View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.checkoutButton} 
              onPress={() => navigation.navigate('Checkout', { 
                cartBilling: {
                  subtotal: totalAmount,
                  storeDiscount: totalDiscount,
                  deliveryFee: deliveryCharge,
                  serviceFee: serviceFee,
                  platformCommission: Number(globalSettings?.platformCommission) || 15,
                  total: finalTotal,
                  etaMins: Math.ceil(baseStdTime + 5)
                }
              })}
            >
              <Text style={styles.checkoutText}>Proceed to Checkout (₹{finalTotal.toFixed(2)})</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { padding: 16, paddingBottom: 100 },
  emptyCartContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCartText: { fontSize: 16, color: '#6B7280', marginBottom: 16 },
  continueBtn: { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  continueBtnText: { color: '#FFF', fontWeight: 'bold' },
  pharmacyGroup: { marginBottom: 16 },
  pharmacyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8 },
  pharmacyName: { marginLeft: 8, fontSize: 14, fontWeight: 'bold', color: '#1E3A8A' },
  itemCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  itemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: '#F3F4F6' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  itemPrice: { fontSize: 14, color: '#059669', fontWeight: 'bold' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 4 },
  qtyText: { marginHorizontal: 12, fontSize: 14, fontWeight: 'bold', color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 12, marginBottom: 16 },
  deliveryOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  deliveryOptionActive: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  deliveryOptionTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  deliveryOptionDesc: { fontSize: 12, color: '#6B7280' },
  deliveryOptionPrice: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, marginBottom: 40, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  summaryTitle: { fontSize: 16, fontWeight: '900', color: '#111827', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  summaryValue: { color: '#111827', fontSize: 14, fontWeight: 'bold' },
  dashedDivider: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 1, marginVertical: 8 },
  summaryTotalLabel: { fontSize: 16, fontWeight: '900', color: '#111827' },
  summaryTotalValue: { fontSize: 18, fontWeight: '900', color: '#0D9494' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  checkoutButton: { backgroundColor: '#0D9494', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  checkoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

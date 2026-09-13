import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle, ShieldCheck, MapPin, AlertTriangle } from 'lucide-react-native';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function PrescriptionQuotesScreen({ route, navigation }) {
  const { requestId } = route.params;
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Modal States
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [selectedQuoteToAccept, setSelectedQuoteToAccept] = useState(null);

  useEffect(() => {
    // Listen for incoming quotes in real-time
    const q = query(collection(db, `prescription_requests/${requestId}/quotes`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quotesData = [];
      snapshot.forEach((doc) => {
        quotesData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by total amount ascending (cheapest first)
      quotesData.sort((a, b) => a.totalAmount - b.totalAmount);
      setQuotes(quotesData);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to quotes:", error);
      Alert.alert("Error", "Could not load quotes.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  const handleAcceptQuote = (quote) => {
    setSelectedQuoteToAccept(quote);
    setAcceptModalVisible(true);
  };

  const confirmAccept = async () => {
    setAcceptModalVisible(false);
    try {
      await updateDoc(doc(db, 'prescription_requests', requestId), {
        status: 'accepted',
        acceptedQuoteId: selectedQuoteToAccept.id
      });
      navigation.replace('Checkout', { quoteData: selectedQuoteToAccept, requestId });
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to accept quote. Please try again.");
    }
  };

  const handleWithdraw = () => {
    setWithdrawModalVisible(true);
  };

  const confirmWithdraw = async () => {
    setWithdrawModalVisible(false);
    try {
      await deleteDoc(doc(db, 'prescription_requests', requestId));
      setSuccessModalVisible(true);
      setTimeout(() => {
        setSuccessModalVisible(false);
        navigation.replace('CustomerRoot');
      }, 1000);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not cancel request. Please try again.");
    }
  };

  const renderQuote = ({ item, index }) => (
    <View style={[styles.quoteCard, index === 0 && styles.bestValueCard]}>
      {index === 0 && (
        <View style={styles.bestValueBadge}>
          <Text style={styles.bestValueText}>Lowest Price</Text>
        </View>
      )}
      
      <View style={styles.quoteHeader}>
        <View>
          <Text style={styles.pharmacyName}>{item.pharmacyName}</Text>
          <View style={styles.ratingRow}>
            <ShieldCheck color="#059669" size={14} style={{ marginRight: 4 }} />
            <Text style={styles.ratingText}>{item.pharmacyRating || 'New'} Rating</Text>
            <Text style={styles.dot}> • </Text>
            <MapPin color="#6B7280" size={14} style={{ marginRight: 4 }} />
            <Text style={styles.distanceText}>{item.distanceKm}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />
      
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Medicines Cost</Text>
        <Text style={styles.costValue}>₹{item.medicinesPrice}</Text>
      </View>
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>GST (18%)</Text>
        <Text style={styles.costValue}>₹{item.gstAmount}</Text>
      </View>
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Delivery Fee</Text>
        <Text style={styles.costValue}>₹{item.deliveryFee}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Payable</Text>
        <Text style={styles.totalValue}>₹{item.totalAmount}</Text>
      </View>

      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptQuote(item)}>
        <CheckCircle color="#FFFFFF" size={18} style={{ marginRight: 8 }} />
        <Text style={styles.acceptBtnText}>Accept & Checkout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Quotes</Text>
        <TouchableOpacity onPress={handleWithdraw} style={styles.withdrawBtn}>
          <Text style={styles.withdrawText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBanner}>
        <ActivityIndicator color="#1E3A8A" size="small" style={{ marginRight: 8 }} />
        <Text style={styles.statusText}>Waiting for nearby pharmacies to respond...</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0D9494" size="large" />
          <Text style={styles.loadingText}>Connecting to pharmacies...</Text>
        </View>
      ) : quotes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No quotes received yet.</Text>
          <Text style={styles.subEmptyText}>Please stay on this page. Pharmacies typically respond within 5-10 minutes.</Text>
        </View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuote}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modern Withdraw Modal */}
      <Modal visible={withdrawModalVisible} transparent={true} animationType="fade" onRequestClose={() => setWithdrawModalVisible(false)}>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalContainer}>
            <View style={styles.modalIconContainerRed}>
              <AlertTriangle color="#EF4444" size={32} />
            </View>
            <Text style={styles.customModalTitle}>Withdraw Request</Text>
            <Text style={styles.customModalMessage}>
              Are you sure you want to cancel this prescription request? This will immediately remove it from all pharmacies.
            </Text>
            <View style={styles.customModalActions}>
              <TouchableOpacity style={styles.customModalBtnSecondary} onPress={() => setWithdrawModalVisible(false)}>
                <Text style={styles.customModalBtnSecondaryText}>No, Keep It</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customModalBtnDanger} onPress={confirmWithdraw}>
                <Text style={styles.customModalBtnDangerText}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Accept Modal */}
      <Modal visible={acceptModalVisible} transparent={true} animationType="fade" onRequestClose={() => setAcceptModalVisible(false)}>
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalContainer}>
            <View style={styles.modalIconContainerGreen}>
              <CheckCircle color="#10B981" size={32} />
            </View>
            <Text style={styles.customModalTitle}>Confirm Acceptance</Text>
            <Text style={styles.customModalMessage}>
              Are you sure you want to accept the quote from <Text style={{fontWeight: 'bold'}}>{selectedQuoteToAccept?.pharmacyName}</Text> for <Text style={{fontWeight: 'bold'}}>₹{selectedQuoteToAccept?.totalAmount}</Text>?
            </Text>
            <View style={styles.customModalActions}>
              <TouchableOpacity style={styles.customModalBtnSecondary} onPress={() => setAcceptModalVisible(false)}>
                <Text style={styles.customModalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customModalBtnPrimary} onPress={confirmAccept}>
                <Text style={styles.customModalBtnPrimaryText}>Accept & Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModalVisible} transparent={true} animationType="fade">
        <View style={styles.customModalOverlay}>
          <View style={styles.customModalContainer}>
            <View style={styles.modalIconContainerGreen}>
              <CheckCircle color="#10B981" size={32} />
            </View>
            <Text style={styles.customModalTitle}>Successfully Cancelled</Text>
            <Text style={styles.customModalMessage}>
              Your prescription request has been successfully withdrawn.
            </Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', elevation: 2 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  withdrawBtn: { padding: 8 },
  withdrawText: { color: '#EF4444', fontWeight: 'bold', fontSize: 14 },
  statusBanner: { flexDirection: 'row', backgroundColor: '#DBEAFE', padding: 12, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#1E3A8A', fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  subEmptyText: { textAlign: 'center', color: '#6B7280', fontSize: 14, lineHeight: 20 },
  quoteCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, borderWidth: 1, borderColor: '#E5E7EB' },
  bestValueCard: { borderColor: '#0D9494', borderWidth: 2 },
  bestValueBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: '#0D9494', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  bestValueText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  quoteHeader: { marginBottom: 12 },
  pharmacyName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  dot: { color: '#9CA3AF' },
  distanceText: { color: '#6B7280', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  costLabel: { color: '#4B5563', fontSize: 14 },
  costValue: { color: '#111827', fontSize: 14, fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalLabel: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
  totalValue: { color: '#0D9494', fontSize: 20, fontWeight: 'bold' },
  acceptBtn: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  // Custom Modal Styles
  customModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  customModalContainer: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  modalIconContainerRed: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalIconContainerGreen: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  customModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8, textAlign: 'center' },
  customModalMessage: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  customModalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  customModalBtnSecondary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', marginRight: 12 },
  customModalBtnSecondaryText: { color: '#4B5563', fontWeight: 'bold', fontSize: 15 },
  customModalBtnDanger: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' },
  customModalBtnDangerText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  customModalBtnPrimary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#0D9494', alignItems: 'center' },
  customModalBtnPrimaryText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }
});

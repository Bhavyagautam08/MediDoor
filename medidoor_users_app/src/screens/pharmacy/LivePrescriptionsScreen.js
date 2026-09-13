import React, { useEffect, useState } from 'react';
import ImageViewer from 'react-native-image-zoom-viewer';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Image, TextInput, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, MapPin, X, Check, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot, getDoc, doc, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function LivePrescriptionsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pharmacyData, setPharmacyData] = useState(null);

  // Modal State
  const [selectedReq, setSelectedReq] = useState(null);
  const [medicinesCost, setMedicinesCost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);

  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    const fetchPharmacyData = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'pharmacies', user.uid));
        if (snap.exists()) {
          setPharmacyData({ id: snap.id, ...snap.data() });
        }
      }
    };
    fetchPharmacyData();
  }, []);

  useEffect(() => {
    if (!pharmacyData) return;

    // Listen to pending prescription requests
    const q = query(collection(db, 'prescription_requests'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingReqs = [];
      const now = new Date();

      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Found request:", doc.id, "Status:", data.status, "ExpiresAt:", data.expiresAt);
        
        let distKm = 0;
        if (data.customerLocation && pharmacyData.latitude && pharmacyData.longitude) {
          distKm = calculateDistance(
            pharmacyData.latitude, pharmacyData.longitude,
            data.customerLocation.latitude, data.customerLocation.longitude
          );
        }

        if (!data.rejectedBy || !data.rejectedBy.includes(pharmacyData.id)) {
          pendingReqs.push({ id: doc.id, distanceKm: distKm.toFixed(1), ...data });
        }
      });

      console.log("Total pending requests loaded:", pendingReqs.length);
      // Sort by newest first
      pendingReqs.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setRequests(pendingReqs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pharmacyData]);

  const calculateQuote = () => {
    const medCost = parseFloat(medicinesCost) || 0;
    const gst = 0; // GST is already included in medicine price
    
    // ₹20 base + ₹10 per km
    const dist = parseFloat(selectedReq?.distanceKm || 0);
    const delivery = parseFloat((20 + (10 * dist)).toFixed(2));
    
    const total = parseFloat((medCost + delivery).toFixed(2));
    return { medCost, gst, delivery, total };
  };

  const handleSubmitQuote = async () => {
    const { medCost, gst, delivery, total } = calculateQuote();
    
    if (medCost <= 0) {
      Alert.alert('Invalid Cost', 'Please enter a valid amount for the medicines.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `prescription_requests/${selectedReq.id}/quotes`), {
        pharmacyId: pharmacyData.id,
        pharmacyName: pharmacyData.name,
        pharmacyRating: pharmacyData.rating || 4.5,
        distanceKm: `${selectedReq.distanceKm} km`,
        medicinesPrice: medCost,
        gstAmount: gst,
        deliveryFee: delivery,
        totalAmount: total,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      Alert.alert('Success', 'Your quote has been submitted to the customer!');
      setSelectedReq(null);
      setMedicinesCost('');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit quote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissRequest = async (reqId) => {
    try {
      await updateDoc(doc(db, 'prescription_requests', reqId), {
        rejectedBy: arrayUnion(pharmacyData.id)
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not dismiss request.');
    }
  };

  const renderRequest = ({ item }) => (
    <TouchableOpacity style={styles.requestCard} onPress={() => { setSelectedReq(item); setMedicinesCost(''); }}>
      <View style={styles.cardLeft}>
        <FileText color="#1E3A8A" size={28} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.reqTitle} numberOfLines={1}>New Request</Text>
        <View style={styles.reqMeta}>
          <MapPin color="#6B7280" size={14} style={{ marginRight: 4 }} />
          <Text style={styles.reqDistance}>{item.distanceKm} km</Text>
          <Text style={{ color: '#D1D5DB', marginHorizontal: 6 }}>•</Text>
          <Text style={styles.reqDistance}>
            {item.createdAt ? `${Math.floor((new Date() - item.createdAt.toDate()) / 60000)}m ago` : 'Now'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.cardRight}>
          <Text style={styles.quoteBtnText}>View</Text>
        </View>
        <TouchableOpacity 
          style={styles.dismissBtn} 
          onPress={(e) => { e.stopPropagation(); handleDismissRequest(item.id); }}
        >
          <X color="#EF4444" size={20} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const { medCost, gst, delivery, total } = selectedReq ? calculateQuote() : {};

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0D9494', '#003366']} style={styles.heroSection}>
        <Text style={styles.headerTitle}>Live Prescriptions</Text>
        <Text style={styles.headerSubtitle}>Submit quotes to nearby customers</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0D9494" size="large" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <FileText color="#D1D5DB" size={64} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>No live requests nearby</Text>
          <Text style={styles.emptySub}>When a customer uploads a prescription within 10km, it will appear here instantly.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Quote Modal */}
      <Modal visible={!!selectedReq} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedReq(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Submit Quote</Text>
            <TouchableOpacity onPress={() => setSelectedReq(null)} style={styles.closeBtn}>
              <X color="#4B5563" size={24} />
            </TouchableOpacity>
          </View>
          
          <FlatList 
            data={[{}]} 
            renderItem={() => (
              <View style={styles.modalBody}>
                {selectedReq?.imageUrl && (
                  <View style={styles.imageWrap}>
                    <Text style={styles.sectionLabel}>Customer Prescription</Text>
                    <TouchableOpacity onPress={() => setIsZoomVisible(true)} activeOpacity={0.8}>
                      <Image source={{ uri: selectedReq.imageUrl }} style={styles.prescriptionImg} />
                      <View style={styles.zoomHintOverlay}>
                        <Text style={styles.zoomHintText}>Tap to View Full Screen</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Enter Medicines Cost (₹)</Text>
                <TextInput
                  style={styles.costInput}
                  placeholder="e.g. 450"
                  keyboardType="numeric"
                  value={medicinesCost}
                  onChangeText={setMedicinesCost}
                />

                <View style={styles.breakdownBox}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Medicines</Text>
                    <Text style={styles.breakdownValue}>₹{medCost.toFixed(2)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Delivery Fee ({selectedReq?.distanceKm} km)</Text>
                    <Text style={styles.breakdownValue}>₹{delivery?.toFixed(2)}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.breakdownRow}>
                    <Text style={styles.totalLabel}>Total Customer Pays</Text>
                    <Text style={styles.totalValue}>₹{total?.toFixed(2)}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.submitQuoteBtn, (!medicinesCost || isSubmitting) && { opacity: 0.5 }]} 
                  onPress={handleSubmitQuote}
                  disabled={!medicinesCost || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send color="#fff" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.submitQuoteBtnText}>Send Quote to Customer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Full Screen Image Zoom Modal */}
      <Modal visible={isZoomVisible} transparent={true} animationType="fade" onRequestClose={() => setIsZoomVisible(false)}>
        <View style={styles.modalBackground}>
          <ImageViewer 
            imageUrls={[{ url: selectedReq?.imageUrl || '' }]} 
            onCancel={() => setIsZoomVisible(false)}
            enableSwipeDown={true}
            renderIndicator={() => null}
            backgroundColor="transparent"
            style={{ width, height }}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setIsZoomVisible(false)}>
            <X color="#FFFFFF" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroSection: { paddingBottom: 20, paddingTop: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  listContent: { padding: 16 },
  requestCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1, alignItems: 'center' },
  cardLeft: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  reqTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  reqMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  reqDistance: { fontSize: 13, color: '#6B7280' },
  cardRight: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  quoteBtnText: { color: '#1E3A8A', fontWeight: 'bold', fontSize: 12 },
  dismissBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 4 },
  modalBody: { padding: 20 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  imageWrap: { marginBottom: 24 },
  prescriptionImg: { width: '100%', height: 350, backgroundColor: '#E5E7EB', borderRadius: 16, resizeMode: 'contain' },
  costInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 18, color: '#111827', fontWeight: 'bold', marginBottom: 24 },
  breakdownBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 32 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  breakdownLabel: { fontSize: 14, color: '#4B5563' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#0D9494' },
  submitQuoteBtn: { flexDirection: 'row', backgroundColor: '#0D9494', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  submitQuoteBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  zoomHintOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  zoomHintText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});

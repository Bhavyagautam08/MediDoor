import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, Dimensions } from 'react-native';
import { ChevronLeft, User, Phone, Mail, MapPin, Calendar, Clock, ShoppingBag, ShieldCheck, ShieldAlert, Check, X, FileText, X as CloseIcon } from 'lucide-react-native';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width } = Dimensions.get('window');

export default function UserDetailsScreen({ route, navigation }) {
  const { userId, role } = route.params;
  const [userData, setUserData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);

  // Mapping internal role names to friendly names and collection names
  const roleConfig = {
    customers: { title: 'Customer Profile', icon: User, collection: 'customers', color: '#F59E0B' },
    partners: { title: 'Driver Profile', icon: MapPin, collection: 'delivery_agents', color: '#3B82F6' },
    pharmacies: { title: 'Pharmacy Profile', icon: ShoppingBag, collection: 'pharmacies', color: '#8B5CF6' }
  };
  const config = roleConfig[role] || roleConfig['customers'];

  useEffect(() => {
    fetchUserData();
  }, [userId, role]);

  const fetchUserData = async () => {
    try {
      // 1. Fetch User Document
      const docRef = doc(db, config.collection, userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert("Error", "User not found.");
        navigation.goBack();
        return;
      }

      // 2. Fetch Order History
      const ordersRef = collection(db, 'orders');
      let q;
      if (role === 'customers') {
        q = query(ordersRef, where('userId', '==', userId));
      } else if (role === 'partners') {
        q = query(ordersRef, where('driverId', '==', userId));
      } else if (role === 'pharmacies') {
        q = query(ordersRef, where('pharmacyId', '==', userId));
      }
      
      if (q) {
        const orderSnap = await getDocs(q);
        const fetchedOrders = [];
        orderSnap.forEach(oDoc => fetchedOrders.push({ id: oDoc.id, ...oDoc.data() }));
        // Sort by date descending
        fetchedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(fetchedOrders);
      }
    } catch (e) {
      console.error("Error fetching user details:", e);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (status) => {
    try {
      const docRef = doc(db, config.collection, userId);
      await updateDoc(docRef, { status });
      setUserData(prev => ({ ...prev, status }));
      Alert.alert("Success", `${userData.name} has been ${status === 'approved' || status === 'active' ? 'approved' : 'suspended'}.`);
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", "Could not update status.");
    }
  };

  const openDocumentViewer = () => {
    if (role === 'pharmacies' && !userData.licenseUrl) {
      Alert.alert("No Document", "This pharmacy did not upload a license document.");
      return;
    }
    if (role === 'partners' && (!userData.documents || Object.keys(userData.documents).length === 0)) {
      Alert.alert("No Documents", "This delivery partner did not upload any documents.");
      return;
    }
    setViewerVisible(true);
  };

  const getDocumentsList = () => {
    if (role === 'pharmacies') return [{ title: 'Pharmacy License', url: userData?.licenseUrl }];
    if (role === 'partners' && userData?.documents) {
      const labels = { aadhaar: 'Aadhaar', pan: 'PAN', dl: 'Driving License', rc: 'Bike RC', insurance: 'Insurance', bank: 'Passbook', photo: 'Photo' };
      return Object.entries(userData.documents)
        .filter(([_, uri]) => uri)
        .map(([key, uri]) => ({ title: labels[key] || key, url: uri }));
    }
    return [];
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  if (!userData) return null;

  const isSuspended = userData.status === 'suspended';
  const isApproved = userData.status === 'approved' || userData.status === 'active' || (!userData.status && role === 'customers');
  const displayId = userData.medidoorId || userData.id.slice(-8).toUpperCase();
  const IconComponent = config.icon;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{config.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: `${config.color}20` }]}>
              <IconComponent color={config.color} size={32} />
            </View>
            <View style={styles.profileTitleRow}>
              <Text style={styles.profileName}>{userData.name || 'Unnamed'}</Text>
              <Text style={styles.profileId}>#{displayId}</Text>
              <View style={styles.statusRow}>
                {isSuspended ? <ShieldAlert size={14} color="#DC2626" /> : (isApproved ? <ShieldCheck size={14} color="#10B981" /> : <ShieldAlert size={14} color="#F59E0B" />)}
                <Text style={[styles.statusText, { color: isSuspended ? '#DC2626' : (isApproved ? '#10B981' : '#F59E0B') }]}>
                  {isSuspended ? 'Suspended' : (isApproved ? 'Active' : 'Pending')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Phone color="#64748B" size={16} style={styles.infoIcon} />
            <Text style={styles.infoText}>{userData.phone || 'No phone provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Mail color="#64748B" size={16} style={styles.infoIcon} />
            <Text style={styles.infoText}>{userData.email || 'No email provided'}</Text>
          </View>
          {(userData.address || role === 'pharmacies') && (
            <View style={styles.infoRow}>
              <MapPin color="#64748B" size={16} style={styles.infoIcon} />
              <Text style={styles.infoText}>{userData.address || 'No address provided'}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Calendar color="#64748B" size={16} style={styles.infoIcon} />
            <Text style={styles.infoText}>Joined: {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {(role === 'pharmacies' || role === 'partners') && (
            <TouchableOpacity style={[styles.actionBtn, styles.docsBtn]} onPress={openDocumentViewer}>
              <FileText color="#3B82F6" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.docsBtnText}>View Documents</Text>
            </TouchableOpacity>
          )}
          
          {isSuspended || !isApproved ? (
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleUpdateStatus(role === 'customers' ? 'active' : 'approved')}>
              <Check color="#FFFFFF" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.approveBtnText}>Approve / Activate</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.suspendBtn]} onPress={() => handleUpdateStatus('suspended')}>
              <X color="#DC2626" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.suspendBtnText}>Suspend Account</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order History */}
        <Text style={styles.sectionTitle}>Order History ({orders.length})</Text>
        {orders.length === 0 ? (
          <View style={styles.emptyOrders}>
            <Text style={styles.emptyOrdersText}>No orders found for this user.</Text>
          </View>
        ) : (
          orders.map((order, idx) => (
            <View key={idx} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{order.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.orderBody}>
                <Text style={styles.orderAmount}>₹{order.totalAmount}</Text>
                <View style={styles.orderStatusBadge}>
                  <Text style={styles.orderStatusText}>{order.status || 'Active'}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Document Viewer Modal */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Documents</Text>
            <TouchableOpacity onPress={() => setViewerVisible(false)} style={styles.closeBtn}>
              <CloseIcon color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {getDocumentsList().length > 0 && (
              <ImageViewer
                imageUrls={getDocumentsList()}
                enableSwipeDown={true}
                onSwipeDown={() => setViewerVisible(false)}
                renderIndicator={(currentIndex, allSize) => (
                  <View style={styles.indicatorContainer}>
                    <Text style={styles.indicatorText}>{getDocumentsList()[currentIndex - 1]?.title} ({currentIndex}/{allSize})</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  body: { flex: 1, padding: 16 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileTitleRow: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  profileId: { fontSize: 13, color: '#64748B', marginBottom: 8, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 13, fontWeight: 'bold', marginLeft: 4 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoIcon: { marginRight: 12 },
  infoText: { fontSize: 14, color: '#334155', flex: 1 },
  actionsContainer: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  docsBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  docsBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 14 },
  approveBtn: { backgroundColor: '#10B981' },
  approveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  suspendBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  suspendBtnText: { color: '#DC2626', fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  emptyOrders: { padding: 24, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12 },
  emptyOrdersText: { color: '#94A3B8', fontSize: 14 },
  orderCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  orderDate: { fontSize: 12, color: '#64748B' },
  orderBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderAmount: { fontSize: 16, fontWeight: 'bold', color: '#10B981' },
  orderStatusBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  orderStatusText: { fontSize: 12, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  modalBackground: { flex: 1, backgroundColor: '#000000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  closeBtn: { padding: 8 },
  indicatorContainer: { position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center', zIndex: 99 },
  indicatorText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }
});

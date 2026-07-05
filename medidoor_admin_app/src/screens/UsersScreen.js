import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Image, ScrollView, Dimensions } from 'react-native';
import { Users, User, Check, X, ShieldAlert, ShieldCheck, MapPin, FileText, X as CloseIcon } from 'lucide-react-native';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

export default function UsersScreen() {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const cList = [];
      snapshot.forEach((doc) => cList.push({ id: doc.id, ...doc.data() }));
      setCustomers(cList);
    });

    const unsubPartners = onSnapshot(collection(db, 'delivery_agents'), (snapshot) => {
      const pList = [];
      snapshot.forEach((doc) => pList.push({ id: doc.id, ...doc.data() }));
      setPartners(pList);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubPartners();
    };
  }, []);

  const handleUpdateStatus = async (id, name, isApproved) => {
    try {
      const docRef = doc(db, 'delivery_agents', id);
      await updateDoc(docRef, { isApproved });
      Alert.alert("Success", `${name} has been ${isApproved ? 'Approved' : 'Rejected/Suspended'}.`);
    } catch (error) {
      console.error("Error updating partner status:", error);
      Alert.alert("Error", "Could not update status.");
    }
  };

  const openDocumentViewer = (partner) => {
    if (!partner.documents || Object.keys(partner.documents).length === 0) {
      Alert.alert("No Documents", "This delivery partner did not upload any documents.");
      return;
    }
    setSelectedPartner(partner);
    setViewerVisible(true);
  };

  const renderCustomer = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: '#F59E0B20' }]}>
          <User color="#F59E0B" size={24} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{item.name || 'Unnamed Customer'}</Text>
          <Text style={styles.detailText}>{item.phone || item.email || 'No contact provided'}</Text>
        </View>
      </View>
    </View>
  );

  const renderPartner = ({ item }) => {
    const isApproved = item.isApproved === true;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: '#3B82F620' }]}>
            <MapPin color="#3B82F6" size={24} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{item.name || 'Unnamed Partner'}</Text>
            <View style={styles.statusRow}>
              {isApproved ? <ShieldCheck size={14} color="#10B981" /> : <ShieldAlert size={14} color="#F59E0B" />}
              <Text style={[styles.statusText, { color: isApproved ? '#10B981' : '#F59E0B' }]}>
                {isApproved ? 'Approved' : 'Pending Approval'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>Phone: {item.phone || 'Not provided'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.documentBtn]}
            onPress={() => openDocumentViewer(item)}
          >
            <FileText color="#3B82F6" size={16} />
            <Text style={styles.documentBtnText}>View Docs</Text>
          </TouchableOpacity>

          <View style={styles.approvalActions}>
            {!isApproved ? (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleUpdateStatus(item.id, item.name, true)}
              >
                <Check color="#FFFFFF" size={16} />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus(item.id, item.name, false)}
              >
                <X color="#DC2626" size={16} />
                <Text style={styles.rejectBtnText}>Suspend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const data = activeTab === 'customers' ? customers : partners;

  // Documents array formatting
  const documentLabels = {
    aadhaar: 'Aadhaar Card',
    pan: 'PAN Card',
    dl: 'Driving License',
    rc: 'Bike RC',
    insurance: 'Bike Insurance',
    bank: 'Bank Passbook',
    photo: 'Passport Photo',
  };

  const getPartnerDocuments = () => {
    if (!selectedPartner || !selectedPartner.documents) return [];
    return Object.entries(selectedPartner.documents).map(([key, uri]) => ({
      title: documentLabels[key] || key,
      uri
    })).filter(doc => doc.uri); // Only return docs that have a URI
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.title}>Users & Partners</Text>
        <Text style={styles.subtitle}>Manage all accounts on the platform</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'customers' && styles.activeTab]}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.tabText, activeTab === 'customers' && styles.activeTabText]}>Customers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'partners' && styles.activeTab]}
          onPress={() => setActiveTab('partners')}
        >
          <Text style={[styles.tabText, activeTab === 'partners' && styles.activeTabText]}>Delivery Partners</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centerContainer}>
          <Users color="#CBD5E1" size={48} />
          <Text style={styles.emptyText}>No {activeTab} found.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'customers' ? renderCustomer : renderPartner}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={viewerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedPartner?.name} - Documents</Text>
            <TouchableOpacity onPress={() => setViewerVisible(false)} style={styles.closeBtn}>
              <CloseIcon color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={styles.modalScroll}
          >
            {getPartnerDocuments().map((doc, index) => (
              <View key={index} style={styles.documentSlide}>
                <Text style={styles.documentTitle}>{doc.title}</Text>
                {doc.uri.startsWith('file://') ? (
                  <View style={styles.fallbackContainer}>
                    <ShieldAlert color="#FCA5A5" size={64} style={{ marginBottom: 16 }} />
                    <Text style={styles.fallbackTitle}>Local Image</Text>
                    <Text style={styles.fallbackText}>
                      Saved as a local path ({doc.uri}) on the user's device. Cloud storage upload is pending implementation.
                    </Text>
                  </View>
                ) : (
                  <Image 
                    source={{ uri: doc.uri }} 
                    style={styles.fullScreenImage} 
                    resizeMode="contain"
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <Text style={styles.swipeHint}>Swipe left/right to view more documents</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screenHeader: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#F1F5F9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  approvalActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  documentBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  documentBtnText: {
    color: '#3B82F6',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  rejectBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  rejectBtnText: {
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
  },
  modalScroll: {
    flex: 1,
  },
  documentSlide: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  documentTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: -40,
    textAlign: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '70%',
  },
  swipeHint: {
    color: '#94A3B8',
    textAlign: 'center',
    paddingBottom: 40,
    fontSize: 14,
  },
  fallbackContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    width: '90%',
  },
  fallbackTitle: {
    color: '#F87171',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  fallbackText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  }
});

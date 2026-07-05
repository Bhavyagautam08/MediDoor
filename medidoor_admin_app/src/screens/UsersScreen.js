import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Image, ScrollView, Dimensions, TextInput } from 'react-native';
import { Users, User, Check, X, ShieldAlert, ShieldCheck, MapPin, FileText, X as CloseIcon, Search, Store } from 'lucide-react-native';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import ImageViewer from 'react-native-image-zoom-viewer';

const { width } = Dimensions.get('window');

export default function UsersScreen({ route, navigation }) {
  const initialTab = route?.params?.initialTab || 'customers';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Sync tab if navigated from dashboard
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

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
    });

    const unsubPharmacies = onSnapshot(collection(db, 'pharmacies'), (snapshot) => {
      const phList = [];
      snapshot.forEach((doc) => phList.push({ id: doc.id, ...doc.data() }));
      setPharmacies(phList);
      setLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubPartners();
      unsubPharmacies();
    };
  }, []);

  const handleUpdateStatus = async (collectionName, id, name, status) => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, { status });
      Alert.alert("Success", `${name} has been ${status === 'approved' ? 'approved' : 'suspended'}.`);
    } catch (error) {
      console.error("Error updating partner status:", error);
      Alert.alert("Error", "Could not update status.");
    }
  };

  const openDocumentViewer = (item) => {
    if (activeTab === 'pharmacies') {
      if (!item.licenseUrl) {
        Alert.alert("No Document", "This pharmacy did not upload a license document.");
        return;
      }
    } else {
      if (!item.documents || Object.keys(item.documents).length === 0) {
        Alert.alert("No Documents", "This delivery partner did not upload any documents.");
        return;
      }
    }
    setSelectedItem(item);
    setViewerVisible(true);
  };

  const renderCustomer = ({ item }) => {
    const isSuspended = item.status === 'suspended';
    const displayId = item.medidoorId || item.id.slice(-8).toUpperCase();
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('UserDetails', { userId: item.id, role: 'customers' })}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: '#F59E0B20' }]}>
            <User color="#F59E0B" size={24} />
          </View>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.name}>{item.name || 'Unnamed Customer'}</Text>
              <Text style={styles.shortId}>#{displayId}</Text>
            </View>
            <View style={styles.statusRow}>
              {isSuspended ? <ShieldAlert size={14} color="#DC2626" /> : <ShieldCheck size={14} color="#10B981" />}
              <Text style={[styles.statusText, { color: isSuspended ? '#DC2626' : '#10B981' }]}>
                {isSuspended ? 'Suspended' : 'Active'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailText}>Phone: {item.phone || item.email || 'No contact provided'}</Text>
        </View>

        <View style={styles.actions}>
          <View style={[styles.approvalActions, { flex: 1, justifyContent: 'flex-end' }]}>
            {isSuspended ? (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleUpdateStatus('customers', item.id, item.name, 'active')}
              >
                <Check color="#FFFFFF" size={16} />
                <Text style={styles.approveBtnText}>Activate</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus('customers', item.id, item.name, 'suspended')}
              >
                <X color="#DC2626" size={16} />
                <Text style={styles.rejectBtnText}>Suspend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPartner = ({ item }) => {
    const isApproved = item.status === 'approved';
    const displayId = item.medidoorId || item.id.slice(-8).toUpperCase();

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('UserDetails', { userId: item.id, role: 'partners' })}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: '#3B82F620' }]}>
            <MapPin color="#3B82F6" size={24} />
          </View>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.name}>{item.name || 'Unnamed Partner'}</Text>
              <Text style={styles.shortId}>#{displayId}</Text>
            </View>
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
                onPress={() => handleUpdateStatus('delivery_agents', item.id, item.name, 'approved')}
              >
                <Check color="#FFFFFF" size={16} />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus('delivery_agents', item.id, item.name, 'suspended')}
              >
                <X color="#DC2626" size={16} />
                <Text style={styles.rejectBtnText}>Suspend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPharmacy = ({ item }) => {
    const isApproved = item.status === 'approved';
    const displayId = item.medidoorId || item.id.slice(-8).toUpperCase();

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('UserDetails', { userId: item.id, role: 'pharmacies' })}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: '#8B5CF620' }]}>
            <Store color="#8B5CF6" size={24} />
          </View>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.shortId}>#{displayId}</Text>
            </View>
            <View style={styles.statusRow}>
              {isApproved ? <ShieldCheck size={14} color="#10B981" /> : <ShieldAlert size={14} color="#F59E0B" />}
              <Text style={[styles.statusText, { color: isApproved ? '#10B981' : '#F59E0B' }]}>
                {isApproved ? 'Approved' : 'Pending Approval'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MapPin color="#64748B" size={16} />
          <Text style={styles.detailText} numberOfLines={1}> {item.address}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailText}>Owner: {item.ownerName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailText}>Phone: {item.phone}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.documentBtn]}
            onPress={() => openDocumentViewer(item)}
          >
            <FileText color="#3B82F6" size={16} />
            <Text style={styles.documentBtnText}>View License</Text>
          </TouchableOpacity>

          <View style={styles.approvalActions}>
            {!isApproved ? (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleUpdateStatus('pharmacies', item.id, item.name, 'approved')}
              >
                <Check color="#FFFFFF" size={16} />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus('pharmacies', item.id, item.name, 'suspended')}
              >
                <X color="#DC2626" size={16} />
                <Text style={styles.rejectBtnText}>Suspend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const rawData = activeTab === 'customers' ? customers : activeTab === 'partners' ? partners : pharmacies;
  const data = rawData.filter(item => {
    const query = searchQuery.toLowerCase();
    const searchId = (item.medidoorId || item.id.slice(-8)).toLowerCase();
    const name = (item.name || '').toLowerCase();
    const phone = (item.phone || '').toLowerCase();
    const email = (item.email || '').toLowerCase();
    return searchId.includes(query) || name.includes(query) || phone.includes(query) || email.includes(query);
  });

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
    if (activeTab === 'pharmacies') {
      if (!selectedItem || !selectedItem.licenseUrl) return [];
      return [{ title: 'Pharmacy License', uri: selectedItem.licenseUrl }];
    }
    if (!selectedItem || !selectedItem.documents) return [];
    return Object.entries(selectedItem.documents).map(([key, uri]) => ({
      title: documentLabels[key] || key,
      uri
    })).filter(doc => doc.uri); // Only return docs that have a URI
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Manage all users, partners, and pharmacies</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'customers' && styles.activeTab]}
          onPress={() => { setActiveTab('customers'); setSearchQuery(''); }}
        >
          <Text style={[styles.tabText, activeTab === 'customers' && styles.activeTabText]}>Customers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'partners' && styles.activeTab]}
          onPress={() => { setActiveTab('partners'); setSearchQuery(''); }}
        >
          <Text style={[styles.tabText, activeTab === 'partners' && styles.activeTabText]}>Drivers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pharmacies' && styles.activeTab]}
          onPress={() => { setActiveTab('pharmacies'); setSearchQuery(''); }}
        >
          <Text style={[styles.tabText, activeTab === 'pharmacies' && styles.activeTabText]}>Pharmacies</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search color="#94A3B8" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : searchQuery.trim().length === 0 ? (
        <View style={styles.centerContainer}>
          <Search color="#CBD5E1" size={48} />
          <Text style={styles.emptyText}>Type a name, ID, or phone to search</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centerContainer}>
          <Users color="#CBD5E1" size={48} />
          <Text style={styles.emptyText}>No matches found.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'customers' ? renderCustomer : activeTab === 'partners' ? renderPartner : renderPharmacy}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={viewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedItem?.name} - {activeTab === 'pharmacies' ? 'License' : 'Documents'}</Text>
            <TouchableOpacity onPress={() => setViewerVisible(false)} style={styles.closeBtn}>
              <CloseIcon color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1 }}>
            {getPartnerDocuments().length > 0 && (
              <ImageViewer
                imageUrls={getPartnerDocuments().map(doc => ({ url: doc.uri }))}
                enableSwipeDown={true}
                onSwipeDown={() => setViewerVisible(false)}
                renderIndicator={(currentIndex, allSize) => (
                  <View style={styles.indicatorContainer}>
                    <Text style={styles.indicatorText}>
                      {getPartnerDocuments()[currentIndex - 1]?.title} ({currentIndex}/{allSize})
                    </Text>
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
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
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
    flex: 1,
  },
  shortId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
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
  },
  indicatorContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  }
});

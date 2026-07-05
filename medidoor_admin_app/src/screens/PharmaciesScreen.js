import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { Store, MapPin, Check, X, ShieldAlert, ShieldCheck, FileText, X as CloseIcon } from 'lucide-react-native';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function PharmaciesScreen() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pharmacies'), (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPharmacies(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateStatus = async (id, name, status) => {
    try {
      const docRef = doc(db, 'pharmacies', id);
      await updateDoc(docRef, { status });
      Alert.alert("Success", `${name} is now ${status}.`);
    } catch (error) {
      console.error("Error updating pharmacy status:", error);
      Alert.alert("Error", "Could not update status.");
    }
  };

  const openDocumentViewer = (pharmacy) => {
    if (!pharmacy.licenseUrl) {
      Alert.alert("No Document", "This pharmacy did not upload a license document.");
      return;
    }
    setSelectedPharmacy(pharmacy);
    setViewerVisible(true);
  };

  const renderItem = ({ item }) => {
    const isApproved = item.status === 'approved';

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: '#8B5CF620' }]}>
            <Store color="#8B5CF6" size={24} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{item.name}</Text>
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
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
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
                onPress={() => handleUpdateStatus(item.id, item.name, 'approved')}
              >
                <Check color="#FFFFFF" size={16} />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleUpdateStatus(item.id, item.name, 'suspended')}
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

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.title}>Pharmacies</Text>
        <Text style={styles.subtitle}>Manage pharmacy registrations</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : pharmacies.length === 0 ? (
        <View style={styles.centerContainer}>
          <Store color="#CBD5E1" size={48} />
          <Text style={styles.emptyText}>No pharmacies found.</Text>
        </View>
      ) : (
        <FlatList
          data={pharmacies}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
            <Text style={styles.modalTitle}>{selectedPharmacy?.name} - License</Text>
            <TouchableOpacity onPress={() => setViewerVisible(false)} style={styles.closeBtn}>
              <CloseIcon color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            {selectedPharmacy?.licenseUrl ? (
              selectedPharmacy.licenseUrl.startsWith('file://') ? (
                <View style={styles.fallbackContainer}>
                  <ShieldAlert color="#FCA5A5" size={64} style={{ marginBottom: 16 }} />
                  <Text style={styles.fallbackTitle}>Local Image Detected</Text>
                  <Text style={styles.fallbackText}>
                    This image was saved as a local path on the user's device ({selectedPharmacy.licenseUrl}) instead of being uploaded to Firebase Storage. 
                    It cannot be viewed across different devices.
                  </Text>
                </View>
              ) : (
                <Image 
                  source={{ uri: selectedPharmacy.licenseUrl }} 
                  style={styles.fullScreenImage} 
                  resizeMode="contain"
                />
              )
            ) : (
              <Text style={{ color: 'white' }}>No image available</Text>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  address: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
    flex: 1,
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
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginHorizontal: 24,
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

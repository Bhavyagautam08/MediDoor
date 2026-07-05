import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Modal, ScrollView, Alert } from 'react-native';
import { ShoppingBag, ChevronRight, Clock, MapPin, Search, X, User, Phone, Package, Navigation, AlertTriangle } from 'lucide-react-native';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Fetch orders, ordered by creation date descending
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = [];
      snapshot.forEach((doc) => {
        ordersList.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ordersList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleForceCancel = async (orderId) => {
    Alert.alert(
      "Force Cancel Order",
      "Are you sure you want to cancel this order? This action cannot be undone.",
      [
        { text: "No, Keep it", style: "cancel" },
        { 
          text: "Cancel WITHOUT Refund", 
          style: "destructive",
          onPress: async () => {
            try {
              const docRef = doc(db, 'orders', orderId);
              await updateDoc(docRef, { status: 'cancelled', refundStatus: 'none' });
              setModalVisible(false);
              Alert.alert("Success", "Order cancelled (No refund logged).");
            } catch (error) {
              console.error("Error cancelling:", error);
              Alert.alert("Error", "Could not cancel order.");
            }
          }
        },
        { 
          text: "Cancel & Issue Refund", 
          style: "destructive",
          onPress: async () => {
            try {
              const docRef = doc(db, 'orders', orderId);
              // Set status to cancelled and refundStatus to issued
              await updateDoc(docRef, { status: 'cancelled', refundStatus: 'issued' });
              setModalVisible(false);
              Alert.alert("Success", "Order cancelled and refund marked as issued.");
            } catch (error) {
              console.error("Error cancelling:", error);
              Alert.alert("Error", "Could not cancel order.");
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('delivered')) return { bg: '#ECFDF5', text: '#059669', dot: '#10B981' };
    if (s.includes('cancel')) return { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' };
    if (s.includes('transit') || s.includes('pick')) return { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' };
    return { bg: '#FEF9C3', text: '#CA8A04', dot: '#EAB308' }; // pending/default
  };

  const renderOrderItem = ({ item }) => {
    const statusColors = getStatusColor(item.status);
    const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Recent';
    const displayId = item.numericId || item.medidoorId || item.id.slice(-8).toUpperCase();

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShoppingBag color="#64748B" size={20} />
            <Text style={styles.orderId}>Order #{displayId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors.dot }]} />
            <Text style={[styles.statusText, { color: statusColors.text }]}>{item.status || 'Pending'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <MapPin color="#94A3B8" size={16} />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.pharmacyName || 'Unknown Pharmacy'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Clock color="#94A3B8" size={16} />
            <Text style={styles.detailText}>{date}</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.totalText}>Total: <Text style={styles.totalAmount}>₹{item.totalAmount || 0}</Text></Text>
          <TouchableOpacity 
            style={styles.detailsBtn}
            onPress={() => {
              setSelectedOrder(item);
              setModalVisible(true);
            }}
          >
            <Text style={styles.detailsBtnText}>View Details</Text>
            <ChevronRight color="#3B82F6" size={16} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const searchId = (order.numericId || order.medidoorId || order.id.slice(-8)).toLowerCase();
    const pharmacyName = (order.pharmacyName || '').toLowerCase();
    return searchId.includes(query) || pharmacyName.includes(query);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>All Orders</Text>
            <Text style={styles.subtitle}>Track and manage platform orders</Text>
          </View>
          <TouchableOpacity 
            style={styles.disputesBtn}
            onPress={() => navigation.navigate('Disputes')}
          >
            <AlertTriangle color="#DC2626" size={20} />
            <Text style={styles.disputesBtnText}>Disputes</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchContainer}>
          <Search color="#94A3B8" size={20} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order ID or Pharmacy..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag color="#CBD5E1" size={48} />
          <Text style={styles.emptyText}>No orders found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detailed Order Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Order Details</Text>
              <Text style={styles.modalSubtitle}>
                #{selectedOrder?.numericId || selectedOrder?.medidoorId || selectedOrder?.id.slice(-8).toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X color="#64748B" size={24} />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              
              {/* Status Banner */}
              <View style={[styles.statusBanner, { backgroundColor: getStatusColor(selectedOrder.status).bg }]}>
                <Text style={[styles.statusBannerText, { color: getStatusColor(selectedOrder.status).text }]}>
                  Current Status: {(selectedOrder.status || 'Pending').toUpperCase()}
                </Text>
              </View>

              {/* OTP Section (Critical for Admin) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Security OTPs</Text>
                <View style={styles.otpContainer}>
                  <View style={styles.otpBox}>
                    <Text style={styles.otpLabel}>Pickup OTP</Text>
                    <Text style={styles.otpValue}>{selectedOrder.pickupOtp || 'N/A'}</Text>
                  </View>
                  <View style={styles.otpBox}>
                    <Text style={styles.otpLabel}>Dropoff OTP</Text>
                    <Text style={styles.otpValue}>{selectedOrder.deliveryOtp || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Details</Text>
                <View style={styles.infoRow}>
                  <User color="#64748B" size={16} />
                  <Text style={styles.infoText}>{selectedOrder.customerName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Phone color="#64748B" size={16} />
                  <Text style={styles.infoText}>{selectedOrder.customerPhone || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MapPin color="#64748B" size={16} />
                  <Text style={styles.infoText}>{selectedOrder.deliveryAddress?.fullAddress || 'N/A'}</Text>
                </View>
              </View>

              {/* Pharmacy Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pharmacy Details</Text>
                <View style={styles.infoRow}>
                  <ShoppingBag color="#64748B" size={16} />
                  <Text style={styles.infoText}>{selectedOrder.pharmacyName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MapPin color="#64748B" size={16} />
                  <Text style={styles.infoText}>{selectedOrder.pharmacyAddress || 'N/A'}</Text>
                </View>
              </View>

              {/* Driver Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Partner</Text>
                {selectedOrder.driverId ? (
                  <>
                    <View style={styles.infoRow}>
                      <Navigation color="#64748B" size={16} />
                      <Text style={styles.infoText}>{selectedOrder.driverName || 'Driver Assigned'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Phone color="#64748B" size={16} />
                      <Text style={styles.infoText}>{selectedOrder.driverPhone || 'No Phone'}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.emptyInfoText}>No driver assigned yet.</Text>
                )}
              </View>

              {/* Items List */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Items Ordered</Text>
                {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                    </View>
                    <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                  </View>
                ))}
              </View>

              {/* Pricing Breakdown */}
              <View style={[styles.section, styles.pricingSection]}>
                <Text style={styles.sectionTitle}>Payment Breakdown</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Items Subtotal</Text>
                  <Text style={styles.priceValue}>₹{selectedOrder.subtotal || 0}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Fee</Text>
                  <Text style={styles.priceValue}>₹{selectedOrder.deliveryFee || 0}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.priceRow}>
                  <Text style={styles.totalLabel}>Grand Total</Text>
                  <Text style={styles.totalValue}>₹{selectedOrder.totalAmount || 0}</Text>
                </View>
              </View>

              {/* Admin Actions */}
              {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                <View style={styles.adminActions}>
                  <TouchableOpacity 
                    style={styles.cancelBtn}
                    onPress={() => handleForceCancel(selectedOrder.id)}
                  >
                    <AlertTriangle color="#DC2626" size={20} />
                    <Text style={styles.cancelBtnText}>Force Cancel Order</Text>
                  </TouchableOpacity>
                  <Text style={styles.warningText}>
                    Use this only if the order is stuck or requested by the customer.
                  </Text>
                </View>
              )}
              
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disputesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  disputesBtnText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginTop: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
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
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  orderDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalText: {
    fontSize: 14,
    color: '#64748B',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginRight: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  statusBanner: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otpLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '600',
  },
  otpValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
  },
  emptyInfoText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemQty: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  pricingSection: {
    backgroundColor: '#F8FAFC',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#475569',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  adminActions: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  }
});

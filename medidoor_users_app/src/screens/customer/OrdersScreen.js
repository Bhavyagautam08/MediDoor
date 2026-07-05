import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Package, MapPin } from 'lucide-react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useDispatch } from 'react-redux';
import { restoreCart } from '../../store/slices/cartSlice';

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  const handleReorder = (orderItems) => {
    dispatch(restoreCart(orderItems || []));
    Alert.alert(
      'Cart Updated',
      'Items from your previous order have been added to your cart!',
      [{ text: 'Go to Cart', onPress: () => navigation.navigate('Cart') }]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered': return '#D1FAE5';
      case 'Out for Delivery': return '#DBEAFE';
      default: return '#F3F4F6';
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedOrders = [];
        querySnapshot.forEach((doc) => {
          fetchedOrders.push({ id: doc.id, ...doc.data() });
        });
        
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error); Alert.alert("Error", `Error fetching orders: ${error?.message || error || "An unexpected error occurred"}`);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const renderOrder = ({ item }) => {
    const isCancelled = item.status === 'Cancelled';
    return (
      <TouchableOpacity 
        style={styles.orderCard}
        activeOpacity={0.7}
        onPress={() => {
          if (isCancelled) {
            Alert.alert('Order Cancelled', 'This order was cancelled and can no longer be tracked.');
          } else {
            navigation.navigate('LiveTracking', { orderId: item.id });
          }
        }}
      >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Order #{item.numericId || item.id.slice(-6).toUpperCase()}</Text>
        <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.orderFooter}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status || 'Placed'}</Text>
        </View>
        <Text style={styles.orderTotal}>₹{item.totalAmount?.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C853" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Package color="#9CA3AF" size={64} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>No orders found.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280' },
  list: { padding: 16 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  orderDate: { fontSize: 14, color: '#6B7280' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  orderTotal: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  trackBtn: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 12 },
  trackTxt: { color: '#fff', fontWeight: 'bold', marginLeft: 4 }
});

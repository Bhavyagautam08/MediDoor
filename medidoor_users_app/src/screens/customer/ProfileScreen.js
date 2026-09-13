import React, { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, MapPin, CreditCard, Headphones, CheckCircle2, Star, ChevronRight, LogOut, ArrowLeft, ClipboardList, FlaskConical, MessageSquare, Info, LogIn } from 'lucide-react-native';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, setDoc } from 'firebase/firestore';
import { useDispatch } from 'react-redux';
import { restoreCart } from '../../store/slices/cartSlice';
import RatingModal from '../../components/RatingModal';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPremiumEnabled, setIsPremiumEnabled] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [ratingTarget, setRatingTarget] = useState('pharmacy');
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch User Data
        const docRef = doc(db, 'customers', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData({ email: currentUser.email, ...docSnap.data() });
        } else {
          setUserData({ email: currentUser.email, name: 'User' });
        }

        // Fetch Orders
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetchedOrders = [];
        for (const docSnap of querySnapshot.docs) {
          const orderData = { id: docSnap.id, ...docSnap.data() };
          if (!orderData.pharmacyName && orderData.pharmacyId) {
            try {
              const pDoc = await getDoc(doc(db, 'pharmacies', orderData.pharmacyId));
              if (pDoc.exists()) {
                orderData.pharmacyName = pDoc.data().name;
              }
            } catch (e) { }
          }
          fetchedOrders.push(orderData);
        }
        
        fetchedOrders.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (new Date(a.createdAt).getTime() || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (new Date(b.createdAt).getTime() || 0);
          return timeB - timeA;
        });

        setOrders(fetchedOrders);

        // Fetch Premium Settings
        try {
          const settingsDoc = await getDoc(doc(db, 'settings', 'app_features'));
          if (settingsDoc.exists() && settingsDoc.data().enablePremium === true) {
            setIsPremiumEnabled(true);
          }
        } catch (err) { console.log('Error fetching premium config:', err); }

      } catch (error) {
        console.error("Error fetching profile data:", error);
        Alert.alert("Error", `Error fetching profile: ${error?.message || error || "An unexpected error occurred"}`);
        setUserData({ email: currentUser?.email, name: 'User' });
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });

    return unsubscribe;
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await auth.signOut();
              navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", `Logout error: ${error?.message || error}`);
            }
          }
        }
      ]
    );
  };

  const handleReorder = (orderItems) => {
    dispatch(restoreCart(orderItems || []));
    Alert.alert(
      'Cart Updated',
      'Items from your previous order have been added to your cart!',
      [{ text: 'Go to Cart', onPress: () => navigation.navigate('Cart') }]
    );
  };

  const handleRatingSubmit = async ({ pharmacyRating, driverRating, review }) => {
    if (!selectedOrderForRating) return;
    try {
      const orderId = selectedOrderForRating?.id;
      if (!orderId) {
        throw new Error('Order ID is missing');
      }

      // Optimistic UI update
      setOrders(currentOrders =>
        currentOrders.map(o => o.id === orderId ? {
          ...o,
          serviceRating: pharmacyRating > 0 ? pharmacyRating : o.serviceRating,
          deliveryRating: driverRating > 0 ? driverRating : o.deliveryRating
        } : o)
      );

      // Firestore update
      const orderRef = doc(db, 'orders', orderId);
      const updateData = {
        reviewText: review || '',
      };
      
      if (pharmacyRating > 0) {
        updateData.serviceRating = pharmacyRating;
        if (selectedOrderForRating.pharmacyId) {
          const pRef = doc(db, 'pharmacies', selectedOrderForRating.pharmacyId);
          const pDoc = await getDoc(pRef);
          if (pDoc.exists()) {
            const pd = pDoc.data();
            let currentCount = pd.reviewCount || 0;
            let currentTotal = pd.totalRating || 0;
            if (currentCount === 0 && pd.rating) {
              currentCount = 1;
              currentTotal = parseFloat(pd.rating);
            }
            const newTotal = currentTotal + pharmacyRating;
            const newCount = currentCount + 1;
            const newRating = (newTotal / newCount).toFixed(1);
            await setDoc(pRef, { rating: newRating, reviewCount: newCount, totalRating: newTotal }, { merge: true });
          }
        }
      }
      
      if (driverRating > 0) {
        updateData.deliveryRating = driverRating;
        if (selectedOrderForRating.riderId) {
          const dRef = doc(db, 'delivery_agents', selectedOrderForRating.riderId);
          const dDoc = await getDoc(dRef);
          if (dDoc.exists()) {
            const dd = dDoc.data();
            let currentCount = dd.reviewCount || 0;
            let currentTotal = dd.totalRating || 0;
            if (currentCount === 0 && dd.rating) {
              currentCount = 1;
              currentTotal = parseFloat(dd.rating);
            }
            const newTotal = currentTotal + driverRating;
            const newCount = currentCount + 1;
            const newRating = (newTotal / newCount).toFixed(1);
            await setDoc(dRef, { rating: newRating, reviewCount: newCount, totalRating: newTotal }, { merge: true });
          }
        }
      }

      await setDoc(orderRef, updateData, { merge: true });
      setSelectedOrderForRating(null);
    } catch (error) {
      console.error("Error updating rating:", error);
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0D9494" />
      </SafeAreaView>
    );
  }

  const name = userData?.name || 'Customer';
  const phone = userData?.phone || userData?.email || 'Not logged in';
  const userId = userData?.medidoorId ? `ID: ${userData.medidoorId}` : 'ID: Pending';

  const renderMenuItem = (title, IconComponent, route, isLast = false, onPressOverride = null) => (
    <TouchableOpacity 
      style={[styles.menuItem, !isLast && styles.menuItemBorder]} 
      onPress={onPressOverride || (() => navigation.navigate(route))}
      activeOpacity={0.7}
    >
      <View style={styles.menuIconWrap}>
        <IconComponent color="#0052CC" size={22} />
      </View>
      <Text style={styles.menuItemText}>{title}</Text>
      <ChevronRight color="#0052CC" size={20} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MY ACCOUNT</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.helpBtn} onPress={() => navigation.navigate('HelpSupport')}>
            <Text style={styles.helpBtnText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 12 }}>
            <LogOut color="#111827" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userInfoSection}>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userPhone}>{phone}  •  {userId}</Text>
        </View>

        {/* Promo Banner */}
        {isPremiumEnabled && (
          <View style={styles.promoBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.promoLogo}>Axoro</Text>
              <View style={styles.promoBadge}><Text style={styles.promoBadgeText}>PREMIUM</Text></View>
            </View>
            <Text style={styles.promoText}>Exclusive benefits and free deliveries</Text>
          </View>
        )}

        {/* Menu List Section */}
        <View style={styles.menuListCard}>
          {renderMenuItem('My Orders', ClipboardList, 'Orders')}
          {renderMenuItem('Manage Address', MapPin, 'Addresses')}
          {renderMenuItem('Create Ticket/Help Support', MessageSquare, 'HelpSupport')}
          {renderMenuItem('Policies', Info, 'HelpSupport', true)}
        </View>



        <View style={styles.divider} />

        {/* Past Orders Section */}
        <Text style={styles.sectionTitle}>PAST ORDERS</Text>

        {orders.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: '#6B7280' }}>No past orders found.</Text>
          </View>
        ) : (
          orders.map((order) => {
            const firstItemName = order.items?.[0]?.name || 'Prescription Medicines';
            const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });

            return (
              <View key={order.id} style={styles.orderCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { if (order.status === 'Cancelled') { Alert.alert('Order Cancelled', 'This order was cancelled and cannot be tracked.'); } else { navigation.navigate('LiveTracking', { orderId: order.id }); } }}
                >
                  {/* Order Top */}
                  <View style={styles.orderTopRow}>
                    <View style={styles.pharmacyIconPlaceholder}>
                      <Text style={{ fontSize: 24 }}>🏥</Text>
                    </View>
                    <View style={styles.orderTopInfo}>
                      <Text style={styles.pharmacyName} numberOfLines={1}>{order.pharmacyName || 'Pharmacy Partner'}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{order.status === 'Delivered' ? 'Delivered' : order.status || 'Active'}</Text>
                      {order.status === 'Delivered' && <CheckCircle2 color="#0D9494" size={14} style={{ marginLeft: 4 }} />}
                    </View>
                  </View>

                  {/* Items */}
                  <View style={styles.itemsSection}>
                    <Text style={styles.itemQuantity}>{order.items?.[0]?.qty || 1} x</Text>
                    <Text style={styles.itemName} numberOfLines={1}>{firstItemName}</Text>
                  </View>
                </TouchableOpacity>

                {/* Ratings Section */}
                <View style={styles.ratingsSection}>
                  {(() => {
                    const isPharmacyRated = typeof order.serviceRating === 'number' && order.serviceRating > 0;
                    const isDriverRated = typeof order.deliveryRating === 'number' && order.deliveryRating > 0;
                    
                    return (
                      <>
                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Pharmacy Rating</Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(i => {
                              const currentRating = order.serviceRating || 0;
                              const isFilled = i <= currentRating;
                              return (
                                <TouchableOpacity
                                  key={`pharmacy-star-${i}`}
                                  disabled={isPharmacyRated}
                                  onPress={() => {
                                    if (!isPharmacyRated) {
                                      setRatingTarget('pharmacy');
                                      setSelectedOrderForRating(order);
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Star
                                    color={isFilled ? "#F59E0B" : "#D1D5DB"}
                                    size={16}
                                    fill={isFilled ? "#F59E0B" : "none"}
                                    style={{ marginRight: 2 }}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.ratingDivider} />

                        <View style={styles.ratingCol}>
                          <Text style={styles.ratingLabel}>Delivery Rating</Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(i => {
                              const currentRating = order.deliveryRating || 0;
                              const isFilled = i <= currentRating;
                              return (
                                <TouchableOpacity
                                  key={`driver-star-${i}`}
                                  disabled={isDriverRated}
                                  onPress={() => {
                                    if (!isDriverRated) {
                                      setRatingTarget('delivery');
                                      setSelectedOrderForRating(order);
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <Star
                                    color={isFilled ? "#F59E0B" : "#D1D5DB"}
                                    size={16}
                                    fill={isFilled ? "#F59E0B" : "none"}
                                    style={{ marginRight: 2 }}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Reorder Button */}
                <TouchableOpacity style={styles.reorderBtn} onPress={() => handleReorder(order.items)}>
                  <Text style={styles.reorderBtnText}>REORDER</Text>
                  <ChevronRight color="#EA580C" size={16} />
                </TouchableOpacity>

                {/* Footer */}
                <View style={styles.orderCardFooter}>
                  <Text style={styles.footerText}>Ordered: {dateStr}  •  Bill Total: ₹{order.totalAmount}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {selectedOrderForRating && (
        <RatingModal
          visible={!!selectedOrderForRating}
          onClose={() => setSelectedOrderForRating(null)}
          onSubmit={handleRatingSubmit}
          pharmacyName={selectedOrderForRating.pharmacyName}
          driverName={selectedOrderForRating.driverName}
          orderItems={selectedOrderForRating.items || []}
          initialPharmacyRating={selectedOrderForRating.serviceRating}
          initialDriverRating={selectedOrderForRating.deliveryRating}
          ratingTarget={ratingTarget}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F9FAFB' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  helpBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFEDD5', borderRadius: 16 },
  helpBtnText: { color: '#EA580C', fontWeight: 'bold', fontSize: 13 },

  content: { paddingBottom: 40 },
  userInfoSection: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  userPhone: { fontSize: 14, color: '#6B7280' },

  promoBanner: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  promoLogo: { fontSize: 18, fontWeight: '900', color: '#E11D48', marginRight: 8, fontStyle: 'italic' },
  promoBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  promoBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  promoText: { fontSize: 13, color: '#4B5563', marginTop: 8, fontWeight: '500' },

  menuListCard: { backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 16, marginBottom: 20, paddingVertical: 8, elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuIconWrap: { marginRight: 14 },
  menuItemText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' },

  divider: { height: 8, backgroundColor: '#F3F4F6', marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', letterSpacing: 0.5, marginHorizontal: 20, marginBottom: 16 },

  orderCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 20, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  orderTopRow: { flexDirection: 'row', alignItems: 'center' },
  pharmacyIconPlaceholder: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  orderTopInfo: { flex: 1 },
  pharmacyName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 2 },
  pharmacyArea: { fontSize: 13, color: '#6B7280' },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 14, fontWeight: 'bold', color: '#0D9494' },

  itemsSection: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  itemQuantity: { fontSize: 13, fontWeight: 'bold', color: '#4B5563', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  itemName: { fontSize: 15, color: '#374151', flex: 1 },

  ratingsSection: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  ratingCol: { flex: 1 },
  ratingLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  starsRow: { flexDirection: 'row' },
  ratingDivider: { width: 1, height: 40, backgroundColor: '#F3F4F6', marginHorizontal: 12 },

  reorderBtn: { flexDirection: 'row', backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#FFEDD5' },
  reorderBtnText: { color: '#EA580C', fontWeight: 'bold', fontSize: 14, marginRight: 4, letterSpacing: 0.5 },

  orderCardFooter: { marginTop: 16, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' }
});


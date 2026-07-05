import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Heart, ArrowLeft, Star, ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';

export default function PharmacyDetailScreen({ route, navigation }) {
  const { pharmacyId } = route.params || {};
  const [activeTab, setActiveTab] = useState('All');
  
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const cartItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [pharmacy, setPharmacy] = useState(null);
  const [allMedicines, setAllMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive tabs from available medicines
  const tabs = ['All', ...new Set(allMedicines.map(m => m.category || 'OTC'))];

  useEffect(() => {
    const fetchPharmacyData = async () => {
      if (!pharmacyId) return;
      try {
        const pDoc = await getDoc(doc(db, 'pharmacies', pharmacyId));
        if (pDoc.exists()) {
          setPharmacy({ id: pDoc.id, ...pDoc.data() });
        }
        const invQ = query(collection(db, 'inventory'), where('pharmacyId', '==', pharmacyId));
        const invSnap = await getDocs(invQ);
        const inv = [];
        invSnap.forEach(d => inv.push({ id: d.id, ...d.data() }));
        setAllMedicines(inv);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacyData();
  }, [pharmacyId]);

  const filteredMedicines = activeTab === 'All' 
    ? allMedicines 
    : allMedicines.filter(m => (m.category || 'OTC') === activeTab);

  const handleAddToCart = (medicine) => {
    dispatch(addToCart({...medicine, pharmacyId, pharmacyObj: pharmacy}));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#00C853" />
      </SafeAreaView>
    );
  }

  if (!pharmacy) return (
    <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
      <Text>Pharmacy not found.</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}><Text style={{color: '#00C853'}}>Go Back</Text></TouchableOpacity>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <LinearGradient colors={['#00C853', '#1565C0']} style={styles.heroSection}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><ArrowLeft color="#111827" size={20} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}><Heart color="#111827" size={20} /></TouchableOpacity>
          </View>

          {/* Pharmacy Info */}
          <View style={styles.pharmacyInfo}>
            <View style={styles.logoCircle}>
              <Text style={{fontSize: 24}}>🏥</Text>
            </View>
            <View style={styles.pharmacyDetails}>
              <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
              <View style={styles.ratingRow}>
                <Star color="#FBBF24" fill="#FBBF24" size={14} />
                <Text style={styles.ratingText}>{pharmacy.rating || '4.5'} ({pharmacy.reviews || '100'}+ reviews)</Text>
              </View>
              <Text style={styles.addressText}>{pharmacy.address || 'Address not set'}</Text>
            </View>
            <View style={[styles.openBadge, pharmacy.open ? {backgroundColor: '#10B981'} : {backgroundColor: '#EF4444'}]}>
              <Text style={[styles.openText, {color: '#FFFFFF'}]}>{pharmacy.open ? 'OPEN' : 'CLOSED'}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Search */}
          <Text style={styles.sectionLabel}>Search medicines</Text>
          <View style={styles.searchContainer}>
            <Search color="#757575" size={20} style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search in this pharmacy..." />
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                {activeTab === tab && <Text style={{ marginRight: 4 }}>✓</Text>}
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Available Medicines */}
          <Text style={styles.sectionTitle}>Available Medicines</Text>
          <View style={styles.grid}>
            {filteredMedicines.length === 0 ? (
              <Text style={{color: '#6B7280', marginVertical: 20}}>No medicines available in this category.</Text>
            ) : (
              filteredMedicines.map((item) => (
                <View key={item.id} style={styles.productCard}>
                  {item.imgUrl ? (
                    <Image source={{ uri: item.imgUrl }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, {backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center'}]}>
                      <Text style={{fontSize: 24}}>💊</Text>
                    </View>
                  )}
                  
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  {item.requiresPrescription && <Text style={{fontSize: 10, color: '#EF4444', fontWeight: 'bold', marginBottom: 2}}>Rx Required</Text>}
                  <Text style={styles.productPrice}>₹{parseFloat(item.price).toFixed(2)}</Text>
                  
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleAddToCart(item)}>
                    <Text style={styles.addBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('CustomerRoot', { screen: 'Cart' })}>
            <ShoppingCart color="#fff" size={20} style={{marginRight: 8}} />
            <Text style={styles.cartButtonText}>View Cart ({cartItemCount} items)</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroSection: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 8, shadowColor: '#00C853', shadowOpacity: 0.3, shadowRadius: 10, paddingBottom: 24, marginBottom: -20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingTop: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  pharmacyInfo: { flexDirection: 'row', paddingHorizontal: 24, alignItems: 'center' },
  logoCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', marginRight: 16, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  pharmacyDetails: { flex: 1 },
  pharmacyName: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginLeft: 6, fontWeight: '600' },
  addressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  openBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, elevation: 2 },
  openText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  content: { padding: 24, paddingTop: 40, backgroundColor: '#FFFFFF', flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  tabsContainer: { flexDirection: 'row', marginBottom: 24 },
  tab: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  activeTab: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  tabText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  activeTabText: { color: '#111827', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCard: { width: '48%', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  productImage: { height: 100, borderRadius: 8, marginBottom: 12, width: '100%', resizeMode: 'cover' },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  productPrice: { fontSize: 14, color: '#059669', fontWeight: '600', marginBottom: 12 },
  substituteCard: { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  substituteLabel: { fontSize: 10, color: '#166534', fontWeight: 'bold' },
  substituteText: { fontSize: 12, color: '#14532D' },
  substitutePrice: { fontSize: 12, color: '#059669', fontWeight: 'bold' },
  subAddBtn: { backgroundColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 4 },
  subAddText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#111827', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  addBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  floatingButtonContainer: { position: 'absolute', bottom: 20, left: 24, right: 24, alignItems: 'center' },
  cartButton: { backgroundColor: '#111827', borderRadius: 30, paddingVertical: 16, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, width: '100%' },
  cartButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});


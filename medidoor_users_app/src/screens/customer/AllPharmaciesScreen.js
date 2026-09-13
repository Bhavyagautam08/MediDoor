import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Star, MapPin } from 'lucide-react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { checkIsOpen } from '../../utils/pharmacyUtils';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AllPharmaciesScreen({ navigation }) {
  const [pharmacies, setPharmacies] = useState([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);

  const fetchPharmacies = async () => {
    try {
      let locCoords = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          locCoords = loc.coords;
          setUserCoords(locCoords);
        }
      } catch (e) {
        console.warn("Location permission not granted or available", e);
      }

      const pharmsSnap = await getDocs(
        collection(db, 'pharmacies')
      );
      const pharms = [];
      pharmsSnap.forEach(doc => {
        const data = doc.data();
        if (checkIsOpen(data)) {
          pharms.push({ id: doc.id, ...data, open: true });
        }
      });

      const updatedPharmacies = pharms.map(p => {
        let dynamicDist = p.deliveryTime || '15-20 mins';
        const pLat = p.latitude || 28.5355;
        const pLon = p.longitude || 77.3910;

        if (locCoords && locCoords.latitude && locCoords.longitude) {
          const calculatedKm = calculateDistance(locCoords.latitude, locCoords.longitude, pLat, pLon);
          dynamicDist = `${calculatedKm.toFixed(1)} km`;
        }
        return { ...p, calculatedDist: dynamicDist, numericDist: parseFloat(dynamicDist) || 999 };
      });

      updatedPharmacies.sort((a, b) => a.numericDist - b.numericDist);
      setPharmacies(updatedPharmacies);
      setFilteredPharmacies(updatedPharmacies);
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
      Alert.alert("Fetch Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPharmacies();
    setRefreshing(false);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredPharmacies(pharmacies);
    } else {
      const lowerText = text.toLowerCase();
      const filtered = pharmacies.filter(p => 
        (p.name && p.name.toLowerCase().includes(lowerText)) || 
        (p.address && p.address.toLowerCase().includes(lowerText))
      );
      setFilteredPharmacies(filtered);
    }
  };

  const renderPharmacy = ({ item }) => (
    <TouchableOpacity
      style={styles.pharmacyCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: item.id })}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.pharmacyImagePlaceholder} />
      ) : (
        <View style={styles.pharmacyImagePlaceholder}>
          <Text style={styles.pharmacyEmoji}>🏥</Text>
        </View>
      )}
      <View style={styles.pharmacyCardContent}>
        <View style={styles.pharmacyHeader}>
          <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
          {checkIsOpen(item) ? (
            <View style={styles.openBadge}><Text style={styles.openText}>Open</Text></View>
          ) : (
            <View style={styles.closedBadge}><Text style={styles.closedText}>Closed</Text></View>
          )}
        </View>
        <Text style={styles.pharmacyAddress} numberOfLines={1}>{item.address || 'Local Pharmacy Partner'}</Text>
        
        <View style={styles.ratingRow}>
          <Star color="#F59E0B" fill="#F59E0B" size={14} />
          <Text style={styles.ratingDistText}> {item.rating || 'New'}  •  </Text>
          <MapPin color="#6B7280" size={12} />
          <Text style={styles.ratingDistText}> {item.calculatedDist}</Text>
          {item.storeDiscount > 0 && (
            <View style={{ marginLeft: 'auto', backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#EF4444' }}>🔥 {item.storeDiscount}% OFF</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0D9494', '#003366']} style={styles.heroSection}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Pharmacies</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.glassSearchBox}>
          <Search color="#FFFFFF" size={20} style={{ marginRight: 8, opacity: 0.8 }} />
          <TextInput
            style={styles.glassSearchInput}
            placeholder="Search pharmacies by name..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </LinearGradient>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0D9494" />
        </View>
      ) : (
        <FlatList
          data={filteredPharmacies}
          keyExtractor={item => item.id}
          renderItem={renderPharmacy}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No pharmacies found.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9494']} progressViewOffset={40} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroSection: { paddingBottom: 20, paddingTop: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  
  glassSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 16, paddingHorizontal: 16, height: 50, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  glassSearchInput: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 16 },
  
  listContent: { padding: 16, paddingBottom: 40 },
  
  pharmacyCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  pharmacyImagePlaceholder: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pharmacyEmoji: { fontSize: 32 },
  pharmacyCardContent: { flex: 1, justifyContent: 'center' },
  pharmacyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pharmacyName: { fontSize: 16, fontWeight: 'bold', color: '#111827', flex: 1, marginRight: 8 },
  pharmacyAddress: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  
  openBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  openText: { color: '#0D9494', fontSize: 10, fontWeight: 'bold' },
  closedBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  closedText: { color: '#EF4444', fontSize: 10, fontWeight: 'bold' },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingDistText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
});

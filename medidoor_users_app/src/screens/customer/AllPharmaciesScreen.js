import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Star, MapPin } from 'lucide-react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import * as Location from 'expo-location';

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

  useEffect(() => {
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

        const pharmsSnap = await getDocs(query(collection(db, 'pharmacies'), where('role', '==', 'Pharmacy Admin')));
        const pharms = [];
        pharmsSnap.forEach(doc => pharms.push({ id: doc.id, ...doc.data() }));

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

        // Sort by distance
        updatedPharmacies.sort((a, b) => a.numericDist - b.numericDist);

        setPharmacies(updatedPharmacies);
        setFilteredPharmacies(updatedPharmacies);
      } catch (error) {
        console.error("Error fetching pharmacies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPharmacies();
  }, []);

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
      <View style={styles.pharmacyImagePlaceholder}>
        <Text style={styles.pharmacyEmoji}>🏥</Text>
      </View>
      <View style={styles.pharmacyCardContent}>
        <View style={styles.pharmacyHeader}>
          <Text style={styles.pharmacyName} numberOfLines={1}>{item.name}</Text>
          {item.open ? (
            <View style={styles.openBadge}><Text style={styles.openText}>Open</Text></View>
          ) : (
            <View style={styles.closedBadge}><Text style={styles.closedText}>Closed</Text></View>
          )}
        </View>
        <Text style={styles.pharmacyAddress} numberOfLines={1}>{item.address || 'Local Pharmacy Partner'}</Text>
        
        <View style={styles.ratingRow}>
          <Star color="#F59E0B" fill="#F59E0B" size={14} />
          <Text style={styles.ratingDistText}> {item.rating || '4.5'}  •  </Text>
          <MapPin color="#6B7280" size={12} />
          <Text style={styles.ratingDistText}> {item.calculatedDist}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Pharmacies</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9CA3AF" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pharmacies by name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00C853" />
        </View>
      ) : filteredPharmacies.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No pharmacies found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPharmacies}
          keyExtractor={item => item.id}
          renderItem={renderPharmacy}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827', letterSpacing: 0.5 },
  
  searchContainer: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },
  
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
  openText: { color: '#00C853', fontSize: 10, fontWeight: 'bold' },
  closedBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  closedText: { color: '#EF4444', fontSize: 10, fontWeight: 'bold' },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingDistText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, BackHandler, ToastAndroid, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Search, FileText, Star, UploadCloud, MapPin, ChevronRight, ChevronDown, House, ShoppingCart, CheckCircle } from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getDocs, query, where } from 'firebase/firestore';
import * as Location from 'expo-location';
import LocationBottomSheet from './LocationBottomSheet';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function HomeScreen({ navigation }) {
  const categories = ['All', 'Chronic', 'OTC', 'Digestion', 'First Aid', 'Supplements', 'Baby Care'];
  const symptoms = ['Fever', 'Cough', 'Acidity', 'Back Pain', 'Hair Care'];

  const [userName, setUserName] = useState('there');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(true);
  const [allInventory, setAllInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearching, setIsSearching] = useState(false);

  const dispatch = useDispatch();

  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isGpsOn, setIsGpsOn] = useState(true);
  const [gpsCoords, setGpsCoords] = useState(null); // set after GPS grant to auto-open map picker
  const [isLocating, setIsLocating] = useState(false);

  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [cartModalItemName, setCartModalItemName] = useState('');

  useEffect(() => {
    let backPressCount = 0;
    const backAction = () => {
      if (navigation.isFocused()) {
        // If user is searching or has a filter active, "Back" should clear it
        if (searchQuery.trim().length > 0 || activeCategory !== 'All') {
          setSearchQuery('');
          setActiveCategory('All');
          return true; // Handled
        }

        // Standard double-back to exit logic
        if (backPressCount === 1) {
          BackHandler.exitApp();
          return true;
        }
        backPressCount = 1;
        if (Platform.OS === 'android') {
          ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        }
        setTimeout(() => {
          backPressCount = 0;
        }, 2000);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [navigation, searchQuery, activeCategory]);

  useEffect(() => {
    const initializeApp = async () => {
      let hasAddress = false;
      let hasLocation = false;
      let locationCoords = null;
      let defaultAddressCoords = null;

      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const snap = await getDoc(doc(db, 'customers', currentUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.name) setUserName(data.name.split(' ')[0]);
            else setUserName(currentUser.email?.split('@')[0] || 'there');

            if (data.addresses && data.addresses.length > 0) {
              let cleanAddrs = data.addresses;
              
              // Automatically wipe any session-based "Current Location" from previous app sessions
              if (cleanAddrs.some(a => a.id === 'temp_gps')) {
                cleanAddrs = cleanAddrs.filter(a => a.id !== 'temp_gps');
                if (cleanAddrs.length > 0 && !cleanAddrs.some(a => a.isDefault)) {
                  cleanAddrs[0].isDefault = true; // Fallback default
                }
                await updateDoc(doc(db, 'customers', currentUser.uid), { addresses: cleanAddrs });
              }
              if (cleanAddrs.length > 0) {
                hasAddress = true;
                setSavedAddresses(cleanAddrs);
                const defaultAddress = cleanAddrs.find(a => a.isDefault) || cleanAddrs[0];
                setSelectedAddress(defaultAddress);
                if (defaultAddress && defaultAddress.latitude) {
                  defaultAddressCoords = { latitude: defaultAddress.latitude, longitude: defaultAddress.longitude };
                }
              }
            }
          }
        } catch (e) {
          console.error("Error fetching user:", e);
        }
      }

      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          hasLocation = true;
          setLocationPermissionGranted(true);
          const providerStatus = await Location.getProviderStatusAsync();
          setIsGpsOn(providerStatus.locationServicesEnabled);
          
          if (providerStatus.locationServicesEnabled) {
            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            locationCoords = loc.coords;
            setUserLocation(locationCoords);
          }
        }
      } catch (error) {
        console.warn("Location error:", error);
      }

      if (!hasAddress && !hasLocation) {
        setShowLocationSheet(true);
      }

      try {
        const pharmsSnap = await getDocs(query(collection(db, 'pharmacies'), where('role', '==', 'Pharmacy Admin')));
        const pharms = [];
        pharmsSnap.forEach(doc => pharms.push({ id: doc.id, ...doc.data() }));

        const invSnap = await getDocs(collection(db, 'inventory'));
        const inv = [];
        invSnap.forEach(doc => inv.push({ id: doc.id, ...doc.data() }));
        setAllInventory(inv);

        const updatedPharmacies = pharms.map(p => {
          let dynamicDist = p.dist || '? km';
          const pLat = p.latitude || 28.5355;
          const pLon = p.longitude || 77.3910;

          let userLat = locationCoords?.latitude;
          let userLon = locationCoords?.longitude;

          if (!userLat && hasAddress && defaultAddressCoords) {
            userLat = defaultAddressCoords.latitude;
            userLon = defaultAddressCoords.longitude;
          }

          if (userLat && userLon) {
            const calculatedKm = calculateDistance(userLat, userLon, pLat, pLon);
            dynamicDist = `${calculatedKm.toFixed(1)} km`;
          }
          return { ...p, calculatedDist: dynamicDist, numericDist: parseFloat(dynamicDist) || 999 };
        });

        updatedPharmacies.sort((a, b) => a.numericDist - b.numericDist);
        setPharmacies(updatedPharmacies);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoadingPharmacies(false);
      }
    };

    initializeApp();
  }, []);

  const handleGrantPermission = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation(loc.coords);
        // Just pass raw coords — LocationBottomSheet will open the map picker
        // centered here and do its own reverse geocoding as user pans
        setGpsCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } else {
        Alert.alert('Permission Denied', 'Location permission is required for accurate delivery.');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveDetectedLocation = async (loc, tag = 'Home') => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const newAddress = {
        id: `gps_${Date.now()}`,
        tag: tag,
        text: loc.formattedAddress,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isDefault: true,
      };

      const updatedList = savedAddresses.filter(a => a.tag?.toLowerCase() !== tag.toLowerCase());
      const finalList = updatedList.map(a => ({ ...a, isDefault: false }));
      finalList.push(newAddress);

      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: finalList,
      });
      setSavedAddresses(finalList);
      setSelectedAddress(newAddress);
      setGpsCoords(null);
      setShowLocationSheet(false);
    } catch (e) {
      console.error('Error saving address:', e);
      Alert.alert('Error', 'Could not save address. Please try again.');
    }
  };

  const handleUseDetectedOnce = async (loc) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const tempAddress = {
        id: 'temp_gps',
        tag: 'Current Location',
        text: loc.formattedAddress,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isDefault: true,
      };

      const updatedList = savedAddresses.map(a => ({ ...a, isDefault: false }));
      const filteredList = updatedList.filter(a => a.id !== 'temp_gps');
      filteredList.unshift(tempAddress);

      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: filteredList,
      });
      setSavedAddresses(filteredList);
      setSelectedAddress(tempAddress);
      setGpsCoords(null);
      setShowLocationSheet(false);
    } catch (e) { console.error(e); }
  };

  const baseResults = allInventory.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' ||
      (item.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query));

    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    if (query === '' && activeCategory === 'All') return false;
    return matchesSearch && matchesCategory;
  });

  const scoredResults = baseResults.map(item => {
    const p = pharmacies.find(ph => ph.id === item.pharmacyId);
    const price = parseFloat(item.price) || 0;
    const distance = p ? parseFloat(p.numericDist) || 5 : 5;
    const rating = p ? parseFloat(p.rating) || 4.0 : 4.0;
    
    // Smart recommendation algorithm:
    // Minimize price, penalize distance (~₹10 per km), reward high ratings (~₹15 per star)
    let score = price + (distance * 10) - (rating * 15);
    
    // Text relevance weighting (Heavily prioritize items whose names actually start with the query)
    const q = searchQuery.toLowerCase().trim();
    if (q.length > 0) {
      const name = item.name?.toLowerCase() || '';
      if (name === q) {
        score -= 5000; // Exact match is absolute highest priority
      } else if (name.startsWith(q)) {
        score -= 2000; // Starts with is very high priority
      } else if (name.includes(q)) {
        score -= 500;  // Contains is medium priority
      }
    }
    
    return { ...item, pharmacyObj: p, score };
  });

  // Sort by lowest score first
  scoredResults.sort((a, b) => a.score - b.score);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <TouchableOpacity onPress={() => setShowLocationSheet(true)} style={styles.locationSelector}>
              <House color="#EA580C" size={20} style={{ marginRight: 6 }} />
              <Text style={styles.greeting}>{selectedAddress ? selectedAddress.tag : 'Home'} </Text>
              <ChevronDown color="#111827" size={18} />
            </TouchableOpacity>
            <View style={styles.locationRow}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {selectedAddress ? selectedAddress.text : (userLocation ? 'Using Live GPS Location' : 'Find your medicines today')}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Bell color="#111827" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search color="#6B7280" size={20} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by medicine, salt, or symptom..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {(searchQuery.trim().length > 0 || activeCategory !== 'All') ? (
          <View style={{ paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitleRow}>
                {searchQuery.trim().length > 0 ? 'Search Results' : `${activeCategory} Medicines`}
              </Text>
              {activeCategory !== 'All' && (
                <TouchableOpacity onPress={() => setActiveCategory('All')}>
                  <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {scoredResults.length === 0 ? (
              <Text style={{ marginTop: 16, color: '#6B7280' }}>No medicines found.</Text>
            ) : (
              scoredResults.map((item, idx) => {
                const p = item.pharmacyObj;
                const isTopRecommendation = idx === 0 && scoredResults.length > 1; // Highlight the best value if there are multiple
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.searchResultCard, isTopRecommendation && styles.recommendedCard]}
                    onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: item.pharmacyId })}
                  >
                    {isTopRecommendation && (
                      <View style={styles.recommendationBadge}>
                        <Star color="#FFFFFF" fill="#FFFFFF" size={10} style={{ marginRight: 4 }} />
                        <Text style={styles.recommendationText}>BEST VALUE</Text>
                      </View>
                    )}

                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.searchItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.searchItemPharmacy} numberOfLines={1}>By <Text style={{fontWeight: '700', color: '#374151'}}>{p?.name || 'a pharmacy'}</Text></Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.searchItemPrice}>₹{parseFloat(item.price).toFixed(2)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.cardFooterRow}>
                      <View style={styles.metaRow}>
                        <View style={styles.metaBadge}>
                          <MapPin color="#EA580C" size={12} style={{ marginRight: 4 }} />
                          <Text style={styles.metaText}>{p?.calculatedDist || 'Unknown'}</Text>
                        </View>
                        <View style={styles.metaBadge}>
                          <Star color="#F59E0B" fill="#F59E0B" size={12} style={{ marginRight: 4 }} />
                          <Text style={styles.metaText}>{p?.rating || '4.5'}</Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={styles.addToCartBtn} 
                        onPress={(e) => { 
                          e.stopPropagation(); 
                          dispatch(addToCart(item)); 
                          setCartModalItemName(item.name);
                          setCartModalVisible(true);
                          setTimeout(() => setCartModalVisible(false), 2000);
                        }}
                      >
                        <ShoppingCart color="#fff" size={14} style={{ marginRight: 6 }} />
                        <Text style={styles.addToCartTxt}>ADD</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          <>
            <View style={styles.uploadCard}>
              <View style={{ flex: 1, zIndex: 2 }}>
                <Text style={styles.uploadTitle}>Quick Upload</Text>
                <Text style={styles.uploadDesc}>Upload your prescription and we'll find the medicines for you.</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={() => navigation.navigate('UploadPrescription')}>
                  <UploadCloud color="#fff" size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.uploadButtonText}>Upload Prescription</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.uploadIconWrap}>
                <FileText color="#1E3A8A" size={64} opacity={0.3} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {categories.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.categoryChip, activeCategory === c && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(c)}
                >
                  <Text style={[styles.categoryText, activeCategory === c && styles.categoryTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleRow}>Nearby Pharmacies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllPharmacies')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pharmacyRow}>
              {isLoadingPharmacies ? (
                <View style={{ padding: 20 }}><ActivityIndicator color="#00C853" /></View>
              ) : pharmacies.length === 0 ? (
                <View style={{ padding: 20 }}><Text style={{ color: '#6B7280' }}>No pharmacies nearby.</Text></View>
              ) : (
                pharmacies.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pharmacyCard}
                    onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: p.id })}
                  >
                    <View style={styles.pharmacyImagePlaceholder}>
                      <Text style={styles.pharmacyEmoji}>🏥</Text>
                    </View>
                    <View style={styles.pharmacyCardContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.pharmacyCardTitle} numberOfLines={1}>{p.name}</Text>
                        {p.open && <View style={styles.openBadge}><Text style={styles.openText}>Open</Text></View>}
                      </View>
                      <View style={styles.ratingRow}>
                        <Star color="#FBBF24" fill="#FBBF24" size={14} />
                        <Text style={styles.ratingDistText}> {p.rating || '4.5'} • {p.calculatedDist || p.dist}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </>
        )}
      </ScrollView>

      <LocationBottomSheet
        visible={showLocationSheet}
        onClose={() => {
          if (selectedAddress || locationPermissionGranted) setShowLocationSheet(false);
          else Alert.alert("Required", "Please select an address or grant location permission.");
        }}
        onGrantPermission={handleGrantPermission}
        locationPermissionGranted={locationPermissionGranted}
        addresses={savedAddresses}
        onSelectAddress={(addr) => {
          setSelectedAddress(addr);
          setShowLocationSheet(false);
        }}
        gpsCoords={gpsCoords}
        onSaveDetectedLocation={handleSaveDetectedLocation}
        onUseDetectedOnce={handleUseDetectedOnce}
        isLocating={isLocating}
        isGpsOn={isGpsOn}
      />

      {/* Modern Add to Cart Toast Modal */}
      <Modal visible={cartModalVisible} transparent={true} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastContainer}>
            <CheckCircle color="#10B981" size={24} style={{ marginRight: 12 }} />
            <Text style={styles.toastText}><Text style={{fontWeight: 'bold'}}>{cartModalItemName}</Text> added to cart!</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  locationSelector: { flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subtitle: { fontSize: 13, color: '#6B7280', flex: 1 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
  searchBox: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 24, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  uploadCard: { backgroundColor: '#2563EB', marginHorizontal: 24, borderRadius: 20, padding: 24, flexDirection: 'row', marginBottom: 28, overflow: 'hidden' },
  uploadTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  uploadDesc: { color: '#BFDBFE', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00C853', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
  uploadButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  uploadIconWrap: { position: 'absolute', right: -10, bottom: -10, zIndex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827', marginLeft: 24, marginBottom: 14 },
  categoryRow: { paddingLeft: 24, marginBottom: 24 },
  categoryChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  categoryChipActive: { backgroundColor: '#111827' },
  categoryText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  categoryTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16, alignItems: 'center' },
  sectionTitleRow: { fontSize: 17, fontWeight: 'bold', color: '#111827' },
  seeAllText: { fontSize: 14, fontWeight: 'bold', color: '#00C853' },
  pharmacyRow: { paddingLeft: 24, paddingBottom: 16 },
  pharmacyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, width: 220, marginRight: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5 },
  pharmacyImagePlaceholder: { height: 120, width: '100%', backgroundColor: '#E0F2FE', borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pharmacyEmoji: { fontSize: 44 },
  pharmacyCardContent: { padding: 12 },
  pharmacyCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', flex: 1 },
  openBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  openText: { fontSize: 10, color: '#065F46', fontWeight: 'bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  ratingDistText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },
  searchResultCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: {width: 0, height: 4}, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchItemName: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 2 },
  searchItemPharmacy: { fontSize: 13, color: '#6B7280' },
  searchItemPrice: { fontSize: 18, color: '#00C853', fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  metaText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  addToCartBtn: { flexDirection: 'row', backgroundColor: '#00C853', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', elevation: 2, shadowColor: '#00C853', shadowOpacity: 0.3, shadowRadius: 4 },
  addToCartTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
  
  // New Styles
  recommendedCard: { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#F0FDF4' },
  recommendationBadge: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignItems: 'center', marginBottom: 12 },
  recommendationText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  toastOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  toastContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: {width: 0, height: 4}, shadowRadius: 10 },
  toastText: { color: '#111827', fontSize: 14 }
});

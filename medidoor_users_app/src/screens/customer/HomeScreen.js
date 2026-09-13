import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, BackHandler, ToastAndroid, Platform, Modal, RefreshControl, Animated, Dimensions, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Bell, Pill, Camera, FileText, ChevronRight, Heart, Activity, Star, Crosshair, ArrowRight, CheckCircle, UploadCloud, ChevronDown, ShoppingCart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';
import LocationBottomSheet from './LocationBottomSheet';
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

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [adConfig, setAdConfig] = useState({ isActive: false, ads: [] });
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const carouselRef = React.useRef(null);
  const { width: windowWidth } = Dimensions.get('window');

  useEffect(() => {
    const unsubscribeAds = onSnapshot(doc(db, 'settings', 'advertisements'), (docSnap) => {
      if (docSnap.exists()) {
        setAdConfig(docSnap.data());
      }
    });

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Listen for unread notifications
    const q = query(
      collection(db, 'customers', currentUser.uid, 'notifications'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => {
      unsubscribe();
      unsubscribeAds();
    };
  }, []);

  useEffect(() => {
    if (!adConfig.isActive || !adConfig.ads || adConfig.ads.length <= 1 || isCarouselHovered) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % adConfig.ads.length;
      carouselRef.current?.scrollToIndex({ index: currentIndex, animated: true });
    }, 1500);

    return () => clearInterval(interval);
  }, [adConfig, isCarouselHovered]);

  useEffect(() => {
    let backPressCount = 0;
    const backAction = () => {
      if (navigation.isFocused()) {
        if (searchQuery.trim().length > 0 || activeCategory !== 'All') {
          setSearchQuery('');
          setActiveCategory('All');
          return true;
        }

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

  const fetchData = async () => {
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

            if (cleanAddrs.some(a => a.id === 'temp_gps')) {
              cleanAddrs = cleanAddrs.filter(a => a.id !== 'temp_gps');
              if (cleanAddrs.length > 0 && !cleanAddrs.some(a => a.isDefault)) {
                cleanAddrs[0].isDefault = true;
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

      const invSnap = await getDocs(collection(db, 'inventory'));
      const inv = [];
      invSnap.forEach(doc => inv.push({ id: doc.id, ...doc.data() }));
      setAllInventory(inv);

      let userLat = null;
      let userLon = null;

      if (hasAddress && defaultAddressCoords) {
        userLat = defaultAddressCoords.latitude;
        userLon = defaultAddressCoords.longitude;
      } else if (locationCoords) {
        userLat = locationCoords.latitude;
        userLon = locationCoords.longitude;
      }

      const validPharmacies = pharms.filter(p => p.latitude && p.longitude);
      const destinations = validPharmacies.map(p => `${p.latitude},${p.longitude}`).join('|');

      let distancesMap = {};

      if (userLat && userLon && destinations.length > 0) {
        const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${userLat},${userLon}&destinations=${destinations}&key=${API_KEY}`;

        try {
          const res = await fetch(url);
          const data = await res.json();

          if (data.status === 'OK' && data.rows && data.rows[0]) {
            const elements = data.rows[0].elements;
            validPharmacies.forEach((p, index) => {
              const element = elements[index];
              if (element && element.status === 'OK') {
                const distKm = element.distance.value / 1000;
                distancesMap[p.id] = `${distKm.toFixed(1)} km`;
              }
            });
          }
        } catch (apiErr) {
          console.warn("Maps API error on Home Screen:", apiErr);
        }
      }

      const updatedPharmacies = pharms.map(p => {
        let dynamicDist = distancesMap[p.id];

        if (!dynamicDist) {
          const pLat = p.latitude;
          const pLon = p.longitude;
          if (userLat && userLon && pLat && pLon) {
            const calculatedKm = calculateDistance(userLat, userLon, pLat, pLon);
            dynamicDist = `${calculatedKm.toFixed(1)} km`;
          } else if (p.dist) {
            dynamicDist = p.dist;
          } else {
            dynamicDist = 'Unknown';
          }
        }

        return { ...p, calculatedDist: dynamicDist, numericDist: parseFloat(dynamicDist) || 999 };
      });

      updatedPharmacies.sort((a, b) => a.numericDist - b.numericDist);
      setPharmacies(updatedPharmacies);
    } catch (err) {
      console.error("Error fetching data:", err);
      Alert.alert("Fetch Error", err.message);
    } finally {
      setIsLoadingPharmacies(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleGrantPermission = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation(loc.coords);
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

    let score = price + (distance * 10) - (rating * 15);

    const q = searchQuery.toLowerCase().trim();
    if (q.length > 0) {
      const name = item.name?.toLowerCase() || '';
      if (name === q) {
        score -= 5000;
      } else if (name.startsWith(q)) {
        score -= 2000;
      } else if (name.includes(q)) {
        score -= 500;
      }
    }

    return { ...item, pharmacyObj: p, score };
  });

  scoredResults.sort((a, b) => a.score - b.score);

  return (
    <SafeAreaView style={styles.container} edges={['right', 'bottom', 'left']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 0, backgroundColor: '#F9FAFB' }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0D9494']} progressViewOffset={80} />
        }
      >
        <LinearGradient colors={['#0D9494', '#0A7878']} style={[styles.heroSection, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => setShowLocationSheet(true)} style={styles.locationSelector}>
                <MapPin color="#A5F3E8" size={16} style={{ marginRight: 4 }} />
                <Text style={styles.greeting} numberOfLines={1}>{selectedAddress ? selectedAddress.tag : 'Set Location'} </Text>
                <ChevronDown color="rgba(255,255,255,0.8)" size={16} />
              </TouchableOpacity>
              <Text style={styles.subtitle} numberOfLines={1}>
                {selectedAddress ? selectedAddress.text : (userLocation ? 'Using Live GPS Location' : 'Find your medicines today')}
              </Text>
            </View>
            <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
              <Bell color="#0D9494" size={22} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.glassSearchBox}>
            <Search color="#FFFFFF" size={20} style={{ marginRight: 10, opacity: 0.85 }} />
            <TextInput
              style={styles.glassSearchInput}
              placeholder="Search medicines, salts, symptoms..."
              placeholderTextColor="rgba(255,255,255,0.75)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </LinearGradient>

        {(searchQuery.trim().length > 0 || activeCategory !== 'All') ? (
          <View style={{ paddingHorizontal: 16 }}>
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
                const isTopRecommendation = idx === 0 && scoredResults.length > 1;
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
                        <Text style={styles.searchItemPharmacy} numberOfLines={1}>By <Text style={{ fontWeight: '700', color: '#374151' }}>{p?.name || 'a pharmacy'}</Text></Text>
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
                          <Text style={styles.metaText}>{p?.rating || 'New'}</Text>
                        </View>
                        {p?.storeDiscount > 0 && (
                          <View style={[styles.metaBadge, { backgroundColor: '#FEF2F2' }]}>
                            <Text style={[styles.metaText, { color: '#EF4444' }]}>🔥 {p.storeDiscount}% OFF</Text>
                          </View>
                        )}
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
            {adConfig.isActive && adConfig.ads && adConfig.ads.length > 0 && (
              <View style={styles.carouselContainer}>
                <Animated.FlatList
                  ref={carouselRef}
                  data={adConfig.ads}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                  onTouchStart={() => setIsCarouselHovered(true)}
                  onTouchEnd={() => setIsCarouselHovered(false)}
                  onScrollBeginDrag={() => setIsCarouselHovered(true)}
                  onMomentumScrollEnd={(e) => {
                    setIsCarouselHovered(false);
                  }}
                  renderItem={({ item }) => (
                    <View style={[styles.adSlide, { width: windowWidth - 32 }]}>
                      <Image source={{ uri: item.imageUrl }} style={styles.adSlideImage} />
                    </View>
                  )}
                />
                <View style={styles.paginatorContainer}>
                  {adConfig.ads.map((_, i) => {
                    const inputRange = [(i - 1) * (windowWidth - 32), i * (windowWidth - 32), (i + 1) * (windowWidth - 32)];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: 'clamp' });
                    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                    const backgroundColor = scrollX.interpolate({ inputRange, outputRange: ['#CBD5E1', '#0D9494', '#CBD5E1'], extrapolate: 'clamp' });
                    return <Animated.View key={i.toString()} style={[styles.dot, { width: dotWidth, opacity, backgroundColor }]} />;
                  })}
                </View>
              </View>
            )}

            <View style={styles.actionTilesRow}>
              <TouchableOpacity
                style={[styles.actionTile, { backgroundColor: '#003366' }]}
                onPress={() => navigation.navigate('UploadPrescription')}
                activeOpacity={0.85}
              >
                <View style={styles.actionTileIconWrap}>
                  <Camera color="#FFFFFF" size={24} />
                </View>
                <View>
                  <Text style={styles.actionTileTitle}>Upload{'\n'}Prescription</Text>
                  <Text style={styles.actionTileDesc}>Get quick quotes</Text>
                </View>
                <View style={styles.actionTileArrow}>
                  <ArrowRight color="#FFFFFF" size={14} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionTile, { backgroundColor: '#0D9494' }]}
                onPress={() => navigation.navigate('LikedPharmacies')}
                activeOpacity={0.85}
              >
                <View style={[styles.actionTileIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Heart color="#FFFFFF" fill="#FFFFFF" size={24} />
                </View>
                <View>
                  <Text style={styles.actionTileTitle}>Liked{'\n'}Pharmacies</Text>
                  <Text style={styles.actionTileDesc}>Your favourites</Text>
                </View>
                <View style={styles.actionTileArrow}>
                  <ArrowRight color="#FFFFFF" size={14} />
                </View>
              </TouchableOpacity>
            </View>


            {/* Shop by Category */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleRow}>Shop by Category</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ShopByCategory')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.categoryRow, { marginBottom: 28 }]}>
              {[
                { id: '1', name: 'Cold & Cough',        emoji: '🤧' },
                { id: '2', name: 'Pain Relief',          emoji: '💊' },
                { id: '7', name: 'Fever & Headache',     emoji: '🌡️' },
                { id: '9', name: 'Baby Care',            emoji: '👶' },
                { id: '20', name: 'Popular Medicines',   emoji: '⭐' },
                { id: '24', name: 'Vitamins & Nutrition', emoji: '💪' },
              ].map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, activeCategory === cat.name && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(activeCategory === cat.name ? 'All' : cat.name)}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{cat.emoji}</Text>
                  <Text style={[styles.categoryText, activeCategory === cat.name && styles.categoryTextActive]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.categoryChip}
                onPress={() => navigation.navigate('ShopByCategory')}
              >
                <Text style={{ fontSize: 18, marginBottom: 4 }}>➕</Text>
                <Text style={styles.categoryText}>More</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleRow}>Nearby Pharmacies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllPharmacies')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pharmacyRow}>
              {isLoadingPharmacies ? (
                <View style={{ padding: 20 }}><ActivityIndicator color="#0D9494" /></View>
              ) : pharmacies.length === 0 ? (
                <View style={{ padding: 20 }}><Text style={{ color: '#6B7280' }}>No pharmacies nearby.</Text></View>
              ) : (
                pharmacies.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pharmacyCard}
                    onPress={() => navigation.navigate('PharmacyDetail', { pharmacyId: p.id })}
                  >
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={styles.pharmacyImagePlaceholder} />
                    ) : (
                      <View style={styles.pharmacyImagePlaceholder}>
                        <Text style={styles.pharmacyEmoji}>🏥</Text>
                      </View>
                    )}
                    <View style={styles.pharmacyCardContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.pharmacyCardTitle} numberOfLines={1}>{p.name}</Text>
                        {p.open && <View style={styles.openBadge}><Text style={styles.openText}>Open</Text></View>}
                      </View>
                      <View style={styles.ratingRow}>
                        <Star color="#FBBF24" fill="#FBBF24" size={14} />
                        <Text style={styles.ratingDistText}> {p.rating || 'New'} • {p.calculatedDist || p.dist}</Text>
                        {p.storeDiscount > 0 && (
                          <View style={{ marginLeft: 'auto', backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#EF4444' }}>🔥 {p.storeDiscount}% OFF</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Bottom Banner */}
            <View style={styles.bottomBanner}>
              <View style={styles.bannerPattern}>
                <Pill color="#D3E5F5" size={28} style={{position: 'absolute', top: 15, left: 20, transform: [{rotate: '45deg'}]}} />
                <Activity color="#D3E5F5" size={36} style={{position: 'absolute', top: 50, right: 25}} />
                <Crosshair color="#D3E5F5" size={24} style={{position: 'absolute', bottom: 30, left: 45}} />
                <FileText color="#D3E5F5" size={32} style={{position: 'absolute', bottom: 15, right: 65, transform: [{rotate: '-15deg'}]}} />
                <Camera color="#D3E5F5" size={24} style={{position: 'absolute', top: 25, left: '50%'}} />
                <Bell color="#D3E5F5" size={28} style={{position: 'absolute', bottom: 50, left: '70%', transform: [{rotate: '15deg'}]}} />
              </View>
              <Image source={require('../../../assets/axoro_logo.jpg')} style={styles.bannerLogo} />
              <Text style={styles.bannerText}>Quality service,</Text>
              <Text style={styles.bannerText}>not just discounts</Text>
            </View>
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

      <Modal visible={cartModalVisible} transparent={true} animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastContainer}>
            <CheckCircle color="#10B981" size={24} style={{ marginRight: 12 }} />
            <Text style={styles.toastText}><Text style={{ fontWeight: 'bold' }}>{cartModalItemName}</Text> added to cart!</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroSection: { paddingHorizontal: 16, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  locationSelector: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  greeting: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', maxWidth: 120 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  bellBadge: { position: 'absolute', top: 9, right: 9, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF' },
  glassSearchBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.22)', marginHorizontal: 0, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', elevation: 3 },
  glassSearchInput: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },

  carouselContainer: { marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  adSlide: { height: 150, borderRadius: 18, overflow: 'hidden' },
  adSlideImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  paginatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  dot: { height: 7, borderRadius: 4, marginHorizontal: 4 },

  actionTilesRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 4, marginBottom: 24, gap: 12 },
  actionTile: { flex: 1, borderRadius: 20, padding: 18, minHeight: 148, justifyContent: 'space-between', elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, overflow: 'hidden' },
  actionTileIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionTileTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', lineHeight: 22, marginBottom: 4 },
  actionTileDesc: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 15 },
  actionTileArrow: { position: 'absolute', bottom: 14, right: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },

  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#111827', marginLeft: 16, marginBottom: 14 },
  categoryRow: { paddingLeft: 16, marginBottom: 24 },
  categoryChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginRight: 10, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, borderWidth: 1, borderColor: '#F3F4F6', minWidth: 72 },
  categoryChipActive: { backgroundColor: '#0D9494', borderColor: '#0D9494' },
  categoryText: { color: '#374151', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  categoryTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14, alignItems: 'center' },
  sectionTitleRow: { fontSize: 17, fontWeight: '900', color: '#111827' },
  seeAllText: { fontSize: 14, fontWeight: 'bold', color: '#0D9494' },
  pharmacyRow: { paddingLeft: 16, paddingBottom: 16 },
  pharmacyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, width: 200, marginRight: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, overflow: 'hidden' },
  pharmacyImagePlaceholder: { height: 110, width: '100%', backgroundColor: '#E0F7F4', alignItems: 'center', justifyContent: 'center' },
  pharmacyEmoji: { fontSize: 44 },
  pharmacyCardContent: { padding: 12 },
  pharmacyCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#111827', flex: 1 },
  openBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  openText: { fontSize: 10, color: '#065F46', fontWeight: 'bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingDistText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },

  // Bottom Banner
  bottomBanner: { marginHorizontal: 0, marginTop: 10, marginBottom: 0, backgroundColor: '#E6F0FA', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 50, paddingBottom: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  bannerPattern: { ...StyleSheet.absoluteFillObject },
  bannerLogo: { width: 140, height: 60, resizeMode: 'contain', marginBottom: 12, opacity: 0.35 },
  bannerText: { fontSize: 24, fontWeight: '900', color: '#8CB3D9', letterSpacing: 0.5, lineHeight: 32 },

  searchResultCard: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchItemName: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 2 },
  searchItemPharmacy: { fontSize: 13, color: '#6B7280' },
  searchItemPrice: { fontSize: 18, color: '#0D9494', fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  metaText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  addToCartBtn: { flexDirection: 'row', backgroundColor: '#0D9494', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', elevation: 2, shadowColor: '#0D9494', shadowOpacity: 0.3, shadowRadius: 4 },
  addToCartTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // New Styles
  recommendedCard: { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#F0FDF4', shadowColor: '#10B981', shadowOpacity: 0.15 },
  recommendationBadge: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  recommendationText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  toastOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  toastContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  toastText: { color: '#111827', fontSize: 14 }
});

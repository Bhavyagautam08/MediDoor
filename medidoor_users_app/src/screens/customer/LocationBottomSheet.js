import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, ActivityIndicator, SafeAreaView, TextInput, Platform, KeyboardAvoidingView
} from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Navigation, House, Briefcase, Search, Crosshair, X, CheckCircle, ChevronRight, ArrowLeft, MapPin } from 'lucide-react-native';

const { height, width } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = '[REDACTED]';

export default function LocationBottomSheet({ 
  visible, 
  onClose, 
  onGrantPermission, 
  addresses, 
  onSelectAddress, 
  locationPermissionGranted,
  gpsCoords,           // raw lat/lng from GPS grant — auto-opens map picker here
  onSaveDetectedLocation,
  onUseDetectedOnce,
  isLocating,
  isGpsOn = true,
}) {
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState('Home');
  const [customTag, setCustomTag] = useState('');

  const [liveGpsOn, setLiveGpsOn] = useState(isGpsOn);

  useEffect(() => {
    if (visible) {
      const checkGps = async () => {
        const enabled = await Location.hasServicesEnabledAsync();
        setLiveGpsOn(enabled);
      };
      checkGps();
      const interval = setInterval(checkGps, 3000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  useEffect(() => {
    if (addresses && addresses.length > 0 && !gpsCoords) {
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddr && defaultAddr.latitude && defaultAddr.longitude) {
        setMapRegion(prev => ({
          ...prev,
          latitude: defaultAddr.latitude,
          longitude: defaultAddr.longitude,
        }));
      }
    }
  }, [addresses, gpsCoords]);
  // Computed map height: screen - status bar - header(~60) - search bar(~80) - action bar(~130)
  const mapHeight = height - 60 - 80 - 140;
  // Center region of the map — address follows this as user pans
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [currentAddress, setCurrentAddress] = useState('Pan the map to pick location');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const placesRef = useRef(null);
  const mapRef = useRef(null);
  const geocodeTimer = useRef(null); // debounce timer
  const [isMapReady, setIsMapReady] = useState(false);

  // Called when user stops panning — debounced reverse geocode of map center
  const handleRegionChangeComplete = (region) => {
    setMapRegion(region);
    // Clear any pending timer to debounce rapid calls
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      setIsReverseGeocoding(true);
      try {
        const result = await Location.reverseGeocodeAsync({
          latitude: region.latitude,
          longitude: region.longitude,
        });
        if (result && result.length > 0) {
          const p = result[0];
          const parts = [p.name, p.street, p.district, p.subregion, p.city, p.region]
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i);
          setCurrentAddress(parts.join(', ') || `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
        }
      } catch {
        setCurrentAddress(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
      } finally {
        setIsReverseGeocoding(false);
      }
    }, 600); // Wait 600ms after user stops panning before geocoding
  };

  const resetManual = () => {
    setShowManualSearch(false);
    setCurrentAddress('Pan the map to pick location');
  };

  // When GPS coords arrive after grant, auto-open map picker centered there
  useEffect(() => {
    if (gpsCoords && visible) {
      const newRegion = {
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setMapRegion(newRegion);
      setShowManualSearch(true);
      
      // Auto fetch the address right away
      handleRegionChangeComplete(newRegion);
      
      if (isMapReady) {
        mapRef.current?.animateToRegion(newRegion, 600);
      }
    }
  }, [gpsCoords, visible, isMapReady]);

  const handleGetCurrentLocation = async () => {
    try {
      setIsReverseGeocoding(true);
      setCurrentAddress('Checking GPS status...');
      
      let enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        if (Platform.OS === 'android') {
           setCurrentAddress('Please turn on GPS...');
           try {
             await Location.enableNetworkProviderAsync();
           } catch (e) {
             // user might have cancelled
           }
           // wait and check if user turned it on
           for (let i = 0; i < 3; i++) {
             await new Promise(resolve => setTimeout(resolve, 2000));
             enabled = await Location.hasServicesEnabledAsync();
             if (enabled) break;
           }
        }
      }

      if (!enabled) {
         setCurrentAddress('GPS is still off. Pan the map.');
         setIsReverseGeocoding(false);
         return;
      }

      setCurrentAddress('Fetching your live location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const newRegion = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setMapRegion(newRegion);
        if (isMapReady) {
          mapRef.current?.animateToRegion(newRegion, 600);
        }
        handleRegionChangeComplete(newRegion);
      }
    } catch (e) {
      console.warn(e);
      setCurrentAddress('Could not fetch location. Pan the map.');
    } finally {
      setIsReverseGeocoding(false);
    }
  };



  if (!visible) return null;

  const selectedPlace = {
    formattedAddress: currentAddress,
    latitude: mapRegion.latitude,
    longitude: mapRegion.longitude,
  };

  const handleFinalSave = () => {
    const finalTag = selectedTag === 'Other' ? customTag.trim() : selectedTag;
    if (!finalTag) {
      alert('Please enter a tag for this address.');
      return;
    }
    onSaveDetectedLocation(selectedPlace, finalTag);
    setShowTagModal(false);
    resetManual();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={showManualSearch ? resetManual : onClose}>
      {showManualSearch ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>

          {/* Header */}
          <View style={styles.searchHeader}>
            <TouchableOpacity onPress={resetManual} style={styles.backBtn}>
              <ArrowLeft color="#111827" size={22} />
            </TouchableOpacity>
            <Text style={styles.searchHeaderTitle}>Set Delivery Location</Text>
          </View>

          {/* Google Places Search — jump to any location */}
          <View style={styles.autocompleteContainer}>
            <GooglePlacesAutocomplete
              ref={placesRef}
              placeholder="Search area, street or landmark..."
              fetchDetails={true}
              onPress={(data, details = null) => {
                if (details?.geometry) {
                  const newRegion = {
                    latitude: details.geometry.location.lat,
                    longitude: details.geometry.location.lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  };
                  setMapRegion(newRegion);
                  mapRef.current?.animateToRegion(newRegion, 600);
                  setCurrentAddress(data.description);
                }
              }}
              query={{ key: GOOGLE_MAPS_KEY, language: 'en', components: 'country:in' }}
              styles={{
                container: { flex: 0, zIndex: 100 },
                textInputContainer: {
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: '#E5E7EB',
                  backgroundColor: '#F9FAFB',
                },
                textInput: {
                  height: 48,
                  fontSize: 14,
                  color: '#111827',
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                },
                listView: {
                  backgroundColor: '#fff',
                  marginTop: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  elevation: 8,
                  zIndex: 100,
                },
                row: { padding: 14, backgroundColor: '#fff' },
                description: { fontSize: 14, color: '#374151' },
                separator: { height: 1, backgroundColor: '#F3F4F6' },
                poweredContainer: { display: 'none' },
              }}
              enablePoweredByContainer={false}
              autoFocus={false}
              debounce={300}
              keepResultsAfterBlur={false}
            />
          </View>

          {/* Full-screen map — pin is FIXED in center, map fills remaining space */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={{ width, height: mapHeight }}
              provider="google"
              initialRegion={mapRegion}
              onMapReady={() => {
                setIsMapReady(true);
                if (gpsCoords) {
                  mapRef.current?.animateToRegion({
                    latitude: gpsCoords.latitude,
                    longitude: gpsCoords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }, 10);
                }
              }}
              onRegionChangeComplete={handleRegionChangeComplete}
            />

            {/* Floating GPS Button */}
            <TouchableOpacity style={styles.myLocationBtn} onPress={handleGetCurrentLocation}>
              <Crosshair color="#EA580C" size={24} />
            </TouchableOpacity>

            {/* Fixed center pin — NEVER moves, always at map center */}
            <View pointerEvents="none" style={[styles.centerPinWrap, { height: mapHeight }]}>
              <Text style={styles.pinEmoji}>{`📍`}</Text>
            </View>
          </View>

          {/* Bottom address card — updates as map moves */}
          <View style={styles.actionBar}>
            <View style={styles.actionAddressRow}>
              {isReverseGeocoding ? (
                <>
                  <ActivityIndicator size="small" color="#EA580C" />
                  <Text style={[styles.actionAddressText, { color: '#9CA3AF', marginLeft: 10 }]}>Fetching address...</Text>
                </>
              ) : (
                <>
                  <MapPin color="#EA580C" size={18} style={{ marginTop: 2, flexShrink: 0 }} />
                  <Text style={styles.actionAddressText} numberOfLines={2}>{currentAddress}</Text>
                </>
              )}
            </View>
            <View style={styles.detectedActions}>
              <TouchableOpacity
                style={[styles.saveBtn, isReverseGeocoding && { opacity: 0.5 }]}
                disabled={isReverseGeocoding}
                onPress={() => setShowTagModal(true)}
              >
                <CheckCircle color="#fff" size={16} />
                <Text style={styles.saveBtnText}>Save Address</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.useOnceBtn, isReverseGeocoding && { opacity: 0.5 }]}
                disabled={isReverseGeocoding}
                onPress={() => { onUseDetectedOnce(selectedPlace); resetManual(); }}
              >
                <Text style={styles.useOnceBtnText}>Use Once</Text>
              </TouchableOpacity>
            </View>
          </View>

        </SafeAreaView>
      ) : (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backgroundTouch} onPress={onClose} activeOpacity={1} />
          
          <View style={styles.sheetContainer}>
          {/* Permission Banner */}
          <View style={[styles.permissionBanner, locationPermissionGranted && liveGpsOn && styles.permissionBannerGranted]}>
            <View style={styles.permissionContent}>
              <Crosshair color="#fff" size={22} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                {locationPermissionGranted ? (
                  liveGpsOn ? (
                    <>
                      <Text style={styles.permissionTitle}>📍 Live GPS Active</Text>
                      <Text style={styles.permissionDesc}>Your location was fetched successfully.</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.permissionTitle}>GPS is Off</Text>
                      <Text style={styles.permissionDesc}>Please turn on device location (GPS).</Text>
                    </>
                  )
                ) : (
                  <>
                    <Text style={styles.permissionTitle}>Location Permission is Off</Text>
                    <Text style={styles.permissionDesc}>Grant permission for accurate delivery.</Text>
                  </>
                )}
              </View>
            </View>
            {!locationPermissionGranted && (
              <TouchableOpacity style={styles.grantBtn} onPress={onGrantPermission} disabled={isLocating}>
                {isLocating 
                  ? <ActivityIndicator size="small" color="#5A8CFF" /> 
                  : <Text style={styles.grantBtnText}>GRANT</Text>
                }
              </TouchableOpacity>
            )}
          </View>



          {/* Address List */}
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Select Delivery Address</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X color="#4B5563" size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            {/* Use Current Location Button */}
            <TouchableOpacity 
              style={styles.addressItem} 
              onPress={() => {
                setShowManualSearch(true);
                handleGetCurrentLocation();
              }}
            >
              <View style={styles.iconWrap}>
                <Crosshair color="#00C853" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addressTag, { color: '#00C853' }]}>Use Current Location</Text>
                <Text style={styles.addressDetails} numberOfLines={1}>Using GPS</Text>
              </View>
              <ChevronRight color="#D1D5DB" size={18} />
            </TouchableOpacity>
            <View style={styles.itemDivider} />

            {addresses && addresses.length > 0 && addresses.map((address) => (
              <View key={address.id}>
                <TouchableOpacity style={styles.addressItem} onPress={() => onSelectAddress(address)}>
                  <View style={styles.iconWrap}>
                    {address.tag === 'Home' ? <House color="#EA580C" size={20} /> :
                     address.tag === 'Work' ? <Briefcase color="#EA580C" size={20} /> :
                     <Navigation color="#EA580C" size={20} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressTag}>{address.tag}</Text>
                    <Text style={styles.addressDetails} numberOfLines={1}>{address.text}</Text>
                  </View>
                  <ChevronRight color="#D1D5DB" size={18} />
                </TouchableOpacity>
                <View style={styles.itemDivider} />
              </View>
            ))}

            <TouchableOpacity style={styles.manualEntryBtn} onPress={() => setShowManualSearch(true)}>
              <View style={styles.iconWrap}>
                <Search color="#EA580C" size={20} />
              </View>
              <Text style={styles.manualEntryText}>Search & Enter Location Manually</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      )}

      {/* TAG SELECTION MODAL (rendered as an overlay) */}
      {showTagModal && (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={[StyleSheet.absoluteFill, styles.overlay, { zIndex: 999 }]}
        >
          <TouchableOpacity style={styles.backgroundTouch} onPress={() => setShowTagModal(false)} />
          <View style={[styles.sheetContainer, { padding: 24, paddingBottom: 32 }]}>
            <Text style={styles.title}>Save address as</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 16 }}>
              {['Home', 'Work', 'College', 'Other'].map(tag => (
                <TouchableOpacity 
                  key={tag}
                  style={[
                    styles.categoryChip, 
                    { marginHorizontal: 0 },
                    selectedTag === tag && styles.categoryChipActive
                  ]}
                  onPress={() => setSelectedTag(tag)}
                >
                  <Text style={[styles.categoryText, selectedTag === tag && styles.categoryTextActive]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTag === 'Other' && (
              <TextInput 
                style={styles.searchInput}
                placeholder="e.g. Gym, Parent's House"
                value={customTag}
                onChangeText={setCustomTag}
                autoFocus
              />
            )}

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 20, flex: 0 }]} onPress={handleFinalSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backgroundTouch: { flex: 1 },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: height * 0.88,
  },
  permissionBanner: {
    backgroundColor: '#5A8CFF',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 18,
  },
  permissionBannerGranted: { backgroundColor: '#059669' },
  permissionContent: { flexDirection: 'row', flex: 1, paddingRight: 12 },
  permissionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  permissionDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },
  grantBtn: {
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 6, minWidth: 65, alignItems: 'center', justifyContent: 'center',
  },
  grantBtnText: { color: '#5A8CFF', fontWeight: 'bold', fontSize: 13 },
  detectedCard: { borderBottomWidth: 1, borderBottomColor: '#FED7AA', backgroundColor: '#FFF7ED', position: 'relative' },
  miniMap: { width: '100%', height: 140 },
  miniPinWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 140, justifyContent: 'center', alignItems: 'center',
  },
  detectedInfo: { padding: 14 },
  detectedTitle: { fontSize: 14, fontWeight: 'bold', color: '#EA580C' },
  detectedAddress: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 12 },
  detectedActions: { flexDirection: 'row', gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EA580C', borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  useOnceBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10,
  },
  useOnceBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#1F2937' },
  closeBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 8 },
  itemDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 40 },
  addressItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  iconWrap: { width: 24, alignItems: 'center', marginRight: 16 },
  addressTag: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  addressDetails: { fontSize: 13, color: '#6B7280' },
  manualEntryBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  manualEntryText: { fontSize: 15, color: '#4B5563', fontWeight: '500' },
  // Map picker full screen
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4, marginRight: 12 },
  searchHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  autocompleteContainer: {
    zIndex: 100, backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  mapContainer: {
    width,
    overflow: 'hidden',
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  centerPinWrap: {
    position: 'absolute',
    top: 0, left: 0,
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 48,
  },
  pinEmoji: {
    fontSize: 42,
    lineHeight: 48,
    textAlign: 'center',
  },
  actionBar: {
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    elevation: 12, shadowColor: '#000',
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  actionAddressRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 10, marginBottom: 14,
  },
  actionAddressText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 20, fontWeight: '500' },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  categoryChipActive: {
    borderColor: '#EA580C', backgroundColor: '#FFF7ED',
  },
  categoryText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  categoryTextActive: { color: '#EA580C', fontWeight: '700' },
  searchInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: '#F9FAFB', color: '#111827',
  },
});

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ActivityIndicator, SafeAreaView } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { ArrowLeft, Crosshair, CheckCircle, MapPin } from 'lucide-react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const { width, height } = Dimensions.get('window');
const mapHeight = height - 160;

export default function MapPickerModal({ visible, onClose, onSelectLocation, initialLocation }) {
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [currentAddress, setCurrentAddress] = useState('Pan the map to pick location');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const mapRef = useRef(null);
  const geocodeTimer = useRef(null);
  
  useEffect(() => {
    if (visible && initialLocation?.latitude && initialLocation?.longitude) {
      setMapRegion({
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      if (initialLocation.address) setCurrentAddress(initialLocation.address);
    }
  }, [visible, initialLocation]);

  const handleRegionChangeComplete = (region) => {
    setMapRegion(region);
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
    }, 600);
  };

  const handleGetCurrentLocation = async () => {
    try {
      setIsReverseGeocoding(true);
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
        mapRef.current?.animateToRegion(newRegion, 600);
        handleRegionChangeComplete(newRegion);
      }
    } catch (e) {
      console.warn(e);
      setCurrentAddress('Could not fetch location.');
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <ArrowLeft color="#111827" size={22} />
          </TouchableOpacity>
          <Text style={styles.searchHeaderTitle}>Select Location</Text>
        </View>

        <View style={styles.autocompleteContainer}>
          <GooglePlacesAutocomplete
            placeholder="Search area or street..."
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
            query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: 'en', components: 'country:in' }}
            styles={{
              container: { flex: 0, zIndex: 100 },
              textInputContainer: { borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
              textInput: { height: 48, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', borderRadius: 12 },
              listView: { backgroundColor: '#fff', marginTop: 4, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', elevation: 8, zIndex: 100 },
            }}
            enablePoweredByContainer={false}
            autoFocus={false}
            debounce={300}
            keepResultsAfterBlur={false}
          />
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={{ width, height: mapHeight }}
            provider="google"
            initialRegion={mapRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
          />

          <TouchableOpacity style={styles.myLocationBtn} onPress={handleGetCurrentLocation}>
            <Crosshair color="#EA580C" size={24} />
          </TouchableOpacity>

          <View pointerEvents="none" style={[styles.centerPinWrap, { height: mapHeight }]}>
            <Text style={styles.pinEmoji}>📍</Text>
          </View>
        </View>

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
          <TouchableOpacity
            style={[styles.saveBtn, isReverseGeocoding && { opacity: 0.5 }]}
            disabled={isReverseGeocoding}
            onPress={() => onSelectLocation({ address: currentAddress, latitude: mapRegion.latitude, longitude: mapRegion.longitude })}
          >
            <CheckCircle color="#fff" size={16} />
            <Text style={styles.saveBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff' },
  backBtn: { padding: 4, marginRight: 12 },
  searchHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  autocompleteContainer: { zIndex: 100, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mapContainer: { width, overflow: 'hidden', flex: 1 },
  myLocationBtn: { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#fff', width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  centerPinWrap: { position: 'absolute', top: 0, left: 0, width, justifyContent: 'center', alignItems: 'center', paddingBottom: 48 },
  pinEmoji: { fontSize: 42, lineHeight: 48, textAlign: 'center' },
  actionBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', elevation: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  actionAddressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  actionAddressText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 20, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9494', borderRadius: 10, paddingVertical: 14, gap: 6 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

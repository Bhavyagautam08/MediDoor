import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, ActivityIndicator, TouchableOpacity, Platform, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MapPin, ArrowLeft, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function MapScreen({ route, navigation }) {
  const { order, pharmacyName, pharmacyAddress, pharmacyLocation } = route?.params || {};
  const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const isPickedUp = order?.status === 'Out for Delivery' || order?.status === 'Picked Up';

  const [riderCoords, setRiderCoords] = useState(null);
  const [heading, setHeading] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [eta, setEta] = useState(null);
  const [livePharmacyName, setLivePharmacyName] = useState(pharmacyName || 'Pharmacy');
  const [livePharmacyAddress, setLivePharmacyAddress] = useState(pharmacyAddress || '');
  const [livePharmacyCoords, setLivePharmacyCoords] = useState(
    pharmacyLocation || order?.pharmacyLocation || null
  );

  useEffect(() => {
    if (order?.pharmacyId) {
      getDoc(doc(db, 'pharmacies', order.pharmacyId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.location) setLivePharmacyCoords(data.location);
          if (data.name) setLivePharmacyName(data.name);
          if (data.address) setLivePharmacyAddress(data.address);
        }
      }).catch(console.warn);
    }
  }, [order?.pharmacyId]);

  const PHARMACY_COORDS = livePharmacyCoords || { latitude: 28.5355, longitude: 77.3910 };
  const HOME_COORDS = order?.customerLocation || order?.location || { latitude: 28.5450, longitude: 77.3960 };


  useEffect(() => {
    let locationSubscription = null;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (location) => {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          const hdg = location.coords.heading !== null && location.coords.heading >= 0 ? location.coords.heading : 0;

          setRiderCoords({ latitude: lat, longitude: lng });
          setHeading(hdg);

          // Push live location to Firestore for the customer to see
          if (order?.id) {
            updateDoc(doc(db, 'orders', order.id), {
              riderLocation: { latitude: lat, longitude: lng, heading: hdg }
            }).catch(console.warn);
          }
        }
      );
    })();
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  if (!riderCoords && !errorMsg) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Getting live location...</Text>
      </View>
    );
  }

  const currentRiderPos = riderCoords || { latitude: 28.5300, longitude: 77.3850 }; // fallback

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ position: 'absolute', left: 16, zIndex: 10 }}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Delivery Route</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          customMapStyle={mapStyle}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: currentRiderPos.latitude,
            longitude: currentRiderPos.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Live Rider Marker with Scooter Image */}
          <Marker
            coordinate={currentRiderPos}
            title="You (Rider)"
            zIndex={999}
            flat={true}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.riderMarker, { transform: [{ rotate: `${(heading || 0) - 45}deg` }] }]}>
              <Navigation color="#10B981" size={24} fill="#10B981" />
            </View>
          </Marker>

          {eta !== null && (
            <Marker
              coordinate={currentRiderPos}
              zIndex={1000}
              anchor={{ x: 0.5, y: 1.5 }}
            >
              <View style={styles.etaBubble}>
                <Text style={styles.etaBubbleText}>ETA : {eta} MINS</Text>
                <View style={styles.etaBubbleTriangle} />
              </View>
            </Marker>
          )}

          {/* Pharmacy Marker */}
          <Marker coordinate={PHARMACY_COORDS} title="Pickup: Pharmacy" pinColor="#3B82F6" />

          {/* Customer Home Marker */}
          <Marker coordinate={HOME_COORDS} title="Dropoff: Customer" pinColor="#F59E0B" />

          {/* Route Lines */}
          {!isPickedUp ? (
            <>
              {/* Driver to Pharmacy (Primary) */}
              <MapViewDirections
                key="route-pharmacy"
                origin={currentRiderPos}
                destination={PHARMACY_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={5}
                strokeColor="#3B82F6"
                onReady={(result) => setEta(Math.ceil(result.duration))}
              />
              {/* Pharmacy to Dropoff (Upcoming) */}
              <MapViewDirections
                key="route-customer"
                origin={PHARMACY_COORDS}
                destination={HOME_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={5}
                strokeColor="#9CA3AF"
                lineDashPattern={[5, 5]}
              />
            </>
          ) : (
            <>
              {/* Driver to Dropoff (Primary) */}
              <MapViewDirections
                key="route-customer-only"
                origin={currentRiderPos}
                destination={HOME_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={5}
                strokeColor="#F59E0B"
                onReady={(result) => setEta(Math.ceil(result.duration))}
              />
            </>
          )}
        </MapView>
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.tripTitle}>Current Trip</Text>
        {errorMsg && <Text style={{ color: 'red', fontSize: 12 }}>{errorMsg}</Text>}
        <View style={styles.tripDetails}>
          <MapPin color="#3B82F6" size={16} />
          <Text style={styles.tripText} numberOfLines={1}> Pickup: {livePharmacyName}</Text>
        </View>
        <View style={styles.tripDetails}>
          <MapPin color="#F59E0B" size={16} />
          <Text style={styles.tripText} numberOfLines={1}> Dropoff: {order?.address || 'Customer Address'}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#1d2c4d"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8ec3b9"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1a3646"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#4b6878"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#64779e"
      }
    ]
  },
  {
    "featureType": "administrative.province",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#4b6878"
      }
    ]
  },
  {
    "featureType": "landscape.man_made",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#334e87"
      }
    ]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#023e58"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#283d6a"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#6f9ba5"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1d2c4d"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#023e58"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3C7680"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#304a7d"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#98a5be"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1d2c4d"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#2c6675"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": "#255763"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#b0d5ce"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#023e58"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#98a5be"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1d2c4d"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#283d6a"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3a4762"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#0e1626"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#4e6d70"
      }
    ]
  }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: Platform.OS === 'android' ? 50 : 60, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', elevation: 4, zIndex: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },
  riderMarker: { backgroundColor: '#fff', padding: 8, borderRadius: 24, borderWidth: 2, borderColor: '#10B981', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  etaBubble: { backgroundColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 4 },
  etaBubbleText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  etaBubbleTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#1F2937', alignSelf: 'center' },
  bottomCard: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 32, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 10, marginTop: -20 },
  tripTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  tripDetails: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tripText: { fontSize: 14, color: '#4B5563', marginLeft: 4 }
});

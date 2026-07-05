import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MapPin, Navigation, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function MapScreen({ route, navigation }) {
  const { order, pharmacyName, pharmacyAddress } = route?.params || {};
  const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  
  const isPickedUp = order?.status === 'Out for Delivery' || order?.status === 'Picked Up';

  // Use order coordinates if available, otherwise fallback
  const PHARMACY_COORDS = order?.pharmacyLocation || { latitude: 28.5355, longitude: 77.3910 };
  const HOME_COORDS = order?.customerLocation || { latitude: 28.5450, longitude: 77.3960 };

  const [riderCoords, setRiderCoords] = useState(null);
  const [heading, setHeading] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

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
        <Text style={{marginTop: 10, color: '#6B7280'}}>Getting live location...</Text>
      </View>
    );
  }

  const currentRiderPos = riderCoords || { latitude: 28.5300, longitude: 77.3850 }; // fallback

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{position: 'absolute', left: 16, zIndex: 10}}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Delivery Route</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView 
          style={styles.map}
          initialRegion={{
            latitude: currentRiderPos.latitude,
            longitude: currentRiderPos.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Live Rider Marker */}
          <Marker 
            coordinate={currentRiderPos} 
            title="You (Rider)" 
            zIndex={999}
            flat={true}
            rotation={heading}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.riderMarker, { transform: [{ rotate: '45deg' }] }]}>
              <Navigation color="#10B981" size={24} fill="#10B981" />
            </View>
          </Marker>

          {/* Pharmacy Marker */}
          <Marker coordinate={PHARMACY_COORDS} title="Pickup: Pharmacy" pinColor="#3B82F6" />
          
          {/* Customer Home Marker */}
          <Marker coordinate={HOME_COORDS} title="Dropoff: Customer" pinColor="#F59E0B" />
          
          {/* Route Lines */}
          {!isPickedUp ? (
            <>
              {/* Driver to Pharmacy (Primary) */}
              <MapViewDirections
                origin={currentRiderPos}
                destination={PHARMACY_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#3B82F6"
              />
              {/* Pharmacy to Dropoff (Upcoming) */}
              <MapViewDirections
                origin={PHARMACY_COORDS}
                destination={HOME_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#9CA3AF"
                lineDashPattern={[5, 5]}
              />
            </>
          ) : (
            <>
              {/* Driver to Dropoff (Primary) */}
              <MapViewDirections
                origin={currentRiderPos}
                destination={HOME_COORDS}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#F59E0B"
              />
            </>
          )}
        </MapView>
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.tripTitle}>Current Trip</Text>
        {errorMsg && <Text style={{color: 'red', fontSize: 12}}>{errorMsg}</Text>}
        <View style={styles.tripDetails}>
          <MapPin color="#3B82F6" size={16} />
          <Text style={styles.tripText} numberOfLines={1}> Pickup: {pharmacyName || 'Pharmacy'}</Text>
        </View>
        <View style={styles.tripDetails}>
          <MapPin color="#F59E0B" size={16} />
          <Text style={styles.tripText} numberOfLines={1}> Dropoff: {order?.address || 'Customer Address'}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: Platform.OS === 'android' ? 50 : 60, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', elevation: 4, zIndex: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },
  riderMarker: { backgroundColor: '#fff', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#10B981', elevation: 5 },
  bottomCard: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 32, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 10, marginTop: -20 },
  tripTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  tripDetails: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tripText: { fontSize: 14, color: '#4B5563', marginLeft: 4 }
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Navigation } from 'lucide-react-native';
import MapView, { Marker } from 'react-native-maps';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function LiveDriversScreen() {
  const [drivers, setDrivers] = useState([]);
  const [allDriversData, setAllDriversData] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'delivery_agents'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setAllDriversData(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching drivers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Heartbeat checker: Filter out drivers whose GPS hasn't updated in 2 minutes
  useEffect(() => {
    const filterActive = () => {
      const now = Date.now();
      const active = allDriversData.filter(d => {
        if (!d.liveLocation || !d.liveLocation.latitude || !d.lastActive) return false;
        // 120,000 ms = 2 minutes
        return (now - d.lastActive) <= 120000;
      });
      setDrivers(active);
    };
    filterActive();
    const interval = setInterval(filterActive, 30000); // Re-check every 30 seconds
    return () => clearInterval(interval);
  }, [allDriversData]);

  useEffect(() => {
    if (drivers.length > 0 && mapRef.current) {
      const coords = drivers.map(d => d.liveLocation);
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [drivers]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Locating active drivers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Drivers</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{drivers.length} Online</Text>
        </View>
      </View>
      
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: drivers.length > 0 ? drivers[0].liveLocation.latitude : 28.5355,
          longitude: drivers.length > 0 ? drivers[0].liveLocation.longitude : 77.3910,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }}
      >
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={driver.liveLocation}
            title={driver.name || 'Delivery Partner'}
            description={`Phone: ${driver.phone || 'N/A'}`}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerPin}>
                <Navigation color="#ffffff" size={14} fill="#ffffff" />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 14,
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 16,
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  markerPin: {
    backgroundColor: '#3B82F6',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }]
  },
});

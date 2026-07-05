import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Trash2, Plus, House, Briefcase, Navigation } from 'lucide-react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import * as Location from 'expo-location';
import LocationBottomSheet from './LocationBottomSheet';

export default function AddressesScreen({ navigation }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Location Bottom Sheet States
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    fetchAddresses();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermissionGranted(status === 'granted');
    } catch (e) { console.warn(e); }
  };

  const fetchAddresses = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'customers', currentUser.uid));
      if (userDoc.exists() && userDoc.data().addresses) {
        setAddresses(userDoc.data().addresses);
      }
    } catch (error) {
      console.error(error); Alert.alert("Error", String(error || "An unexpected error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleGrantPermission = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGpsCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } else {
        Alert.alert('Permission Denied', 'Location permission is required to accurately pin your address.');
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveDetectedLocation = async (loc, tag = 'Home') => {
    try {
      const currentUser = auth.currentUser;
      const isFirst = addresses.length === 0;
      
      const newAddress = {
        id: `addr_${Date.now()}`,
        tag: tag,
        text: loc.formattedAddress,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isDefault: isFirst,
      };

      const updatedAddresses = [...addresses, newAddress];

      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: updatedAddresses,
      });
      
      setAddresses(updatedAddresses);
      setGpsCoords(null);
      setShowLocationSheet(false);
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address.');
    }
  };

  const handleDeleteAddress = async (addressObj) => {
    try {
      const currentUser = auth.currentUser;
      const newAddresses = addresses.filter(a => a.id !== addressObj.id);
      
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: newAddresses
      });
      setAddresses(newAddresses);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete address.');
    }
  };

  const handleSetDefault = async (addressObj) => {
    try {
      const currentUser = auth.currentUser;
      const updatedAddresses = addresses.map(a => ({
        ...a,
        isDefault: a.id === addressObj.id
      }));

      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: updatedAddresses
      });
      setAddresses(updatedAddresses);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update default address.');
    }
  };

  const handleUseDetectedOnce = async (loc) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const tempAddress = {
        id: 'temp_gps',
        tag: 'Current Location',
        text: loc.formattedAddress,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isDefault: true,
      };

      const updatedList = addresses.map(a => ({ ...a, isDefault: false }));
      const filteredList = updatedList.filter(a => a.id !== 'temp_gps');
      filteredList.unshift(tempAddress);

      await updateDoc(doc(db, 'customers', currentUser.uid), {
        addresses: filteredList,
      });
      setAddresses(filteredList);
      setGpsCoords(null);
      setShowLocationSheet(false);
      navigation.goBack();
    } catch (e) { console.error(e); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        
        {/* Simplified Add Address Trigger */}
        <View style={styles.addSection}>
          <TouchableOpacity 
            style={styles.addBtnTrigger} 
            onPress={() => setShowLocationSheet(true)}
            activeOpacity={0.8}
          >
            <Plus color="#00C853" size={24} />
            <Text style={styles.addBtnTriggerText}>Add New Address</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00C853" style={{ marginTop: 40 }} />
        ) : (
          <FlatList 
            data={addresses.filter(a => a.id !== 'temp_gps')}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerEmpty}>
                <MapPin color="#9CA3AF" size={64} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>No saved addresses.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.addressCard, item.isDefault && styles.addressCardDefault]}
                onPress={() => handleSetDefault(item)}
              >
                <View style={styles.addressLeft}>
                  <View style={[styles.iconWrap, item.isDefault && {backgroundColor: '#D1FAE5'}]}>
                    {item.tag === 'Home' ? <House color={item.isDefault ? "#00C853" : "#6B7280"} size={20} /> :
                     item.tag === 'Work' ? <Briefcase color={item.isDefault ? "#00C853" : "#6B7280"} size={20} /> :
                     <Navigation color={item.isDefault ? "#00C853" : "#6B7280"} size={20} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.tagLabel}>{item.tag}</Text>
                      {item.isDefault && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>}
                    </View>
                    <Text style={styles.addressText}>{item.text}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAddress(item)} style={styles.deleteBtn}>
                  <Trash2 color="#EF4444" size={20} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <LocationBottomSheet
        visible={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        onGrantPermission={handleGrantPermission}
        locationPermissionGranted={locationPermissionGranted}
        addresses={addresses}
        onSelectAddress={(addr) => {
          setShowLocationSheet(false);
          handleSetDefault(addr);
        }}
        gpsCoords={gpsCoords}
        onSaveDetectedLocation={handleSaveDetectedLocation}
        onUseDetectedOnce={handleUseDetectedOnce}
        isLocating={isLocating}
        isGpsOn={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { flex: 1 },
  addSection: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  addBtnTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', borderStyle: 'dashed' },
  addBtnTriggerText: { color: '#00C853', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  list: { padding: 16 },
  centerEmpty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#6B7280', fontSize: 16 },
  addressCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: 'flex-start', justifyContent: 'space-between', borderWidth: 1, borderColor: '#fff' },
  addressCardDefault: { borderColor: '#00C853', backgroundColor: '#F0FDF4' },
  addressLeft: { flexDirection: 'row', flex: 1, marginRight: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tagLabel: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  defaultBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, marginBottom: 4 },
  defaultBadgeText: { fontSize: 10, color: '#065F46', fontWeight: 'bold' },
  addressText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  deleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
});

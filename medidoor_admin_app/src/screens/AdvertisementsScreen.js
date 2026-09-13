import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Settings, Save, ChevronLeft, Plus, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';

export default function AdvertisementsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState({
    isActive: true,
    ads: []
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'advertisements');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({
          isActive: data.isActive !== undefined ? data.isActive : true,
          ads: data.ads || []
        });
      } else {
        await setDoc(docRef, { isActive: true, ads: [] });
      }
    } catch (error) {
      console.error("Error fetching advertisements config:", error);
    }
    setLoading(false);
  };

  const handleToggle = async (val) => {
    const newConfig = { ...config, isActive: val };
    setConfig(newConfig);
    try {
      await updateDoc(doc(db, 'settings', 'advertisements'), { isActive: val });
    } catch (error) {
      console.error("Error updating toggle:", error);
    }
  };

  const handleAddAd = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to upload banners.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploading(true);
        
        const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const newAds = [...config.ads, { id: Date.now().toString(), imageUrl: dataUrl }];
        
        setConfig(prev => ({ ...prev, ads: newAds }));
        
        await updateDoc(doc(db, 'settings', 'advertisements'), { ads: newAds });
        setUploading(false);
      }
    } catch (err) {
      console.error(err);
      setUploading(false);
      Alert.alert('Error', 'Could not upload banner image.');
    }
  };

  const handleDeleteAd = async (id, imageUrl) => {
    Alert.alert(
      "Delete Banner",
      "Are you sure you want to remove this banner from the Customer App?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const newAds = config.ads.filter(ad => ad.id !== id);
            setConfig(prev => ({ ...prev, ads: newAds }));
            try {
              await updateDoc(doc(db, 'settings', 'advertisements'), { ads: newAds });
            } catch (error) {
              console.error("Error deleting ad:", error);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Advertisements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Global Visibility</Text>
          <Text style={styles.sectionSubtitle}>Turn the promotional carousel ON or OFF in the Customer App.</Text>
          
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.switchLabel}>Show Carousel Section</Text>
              <Text style={styles.switchHelper}>If disabled, the entire banner section is hidden.</Text>
            </View>
            <Switch
              value={config.isActive}
              onValueChange={handleToggle}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Banners</Text>
              <Text style={styles.sectionSubtitle}>Manage the images shown in the carousel.</Text>
            </View>
            <TouchableOpacity 
              style={[styles.addButton, uploading && { opacity: 0.5 }]} 
              onPress={handleAddAd}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Plus color="#FFFFFF" size={16} style={{ marginRight: 4 }} />
                  <Text style={styles.addButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {config.ads.length === 0 ? (
            <View style={styles.emptyCard}>
              <ImageIcon color="#94A3B8" size={32} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No banners added yet.</Text>
            </View>
          ) : (
            config.ads.map((ad, index) => (
              <View key={ad.id} style={styles.adCard}>
                <Image source={{ uri: ad.imageUrl }} style={styles.adImage} />
                <View style={styles.adFooter}>
                  <Text style={styles.adIndexText}>Banner {index + 1}</Text>
                  <TouchableOpacity onPress={() => handleDeleteAd(ad.id, ad.imageUrl)} style={styles.deleteBtn}>
                    <Trash2 color="#EF4444" size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  body: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16, marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  switchLabel: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  switchHelper: { fontSize: 12, color: '#64748B', marginTop: 4 },
  addButton: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  adCard: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  adImage: { width: '100%', height: 180, resizeMode: 'cover' },
  adFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F1F5F9' },
  adIndexText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 }
});

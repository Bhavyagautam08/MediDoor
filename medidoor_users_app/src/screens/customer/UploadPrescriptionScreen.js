import React, { useState } from 'react';
import ImageViewer from 'react-native-image-zoom-viewer';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Camera, FileUp, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth, db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function UploadPrescriptionScreen({ navigation }) {
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);

  const pickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera access is required.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.3,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleUpload = async () => {
    if (!imageUri || !imageBase64) {
      Alert.alert('Missing Image', 'Please capture or select a prescription image first. If you just saw an error, you must re-select it.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    setIsUploading(true);

    try {
      let coords = null;
      
      // 1. Fetch saved address from Firestore
      const userDocSnap = await getDoc(doc(db, 'customers', user.uid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.addresses && userData.addresses.length > 0) {
          const defaultAddr = userData.addresses.find(a => a.isDefault) || userData.addresses[0];
          if (defaultAddr && defaultAddr.latitude && defaultAddr.longitude) {
            coords = { latitude: defaultAddr.latitude, longitude: defaultAddr.longitude };
          }
        }
      }

      // 2. Fallback to live GPS ONLY if no saved address exists
      if (!coords) {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
           const req = await Location.requestForegroundPermissionsAsync();
           status = req.status;
        }
        
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = loc.coords;
        } else {
          Alert.alert('Address Required', 'We could not find a saved address and location access was denied. Please add an address on the Home page first.');
          setIsUploading(false);
          return;
        }
      }

      const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

      const docRef = await addDoc(collection(db, 'prescription_requests'), {
        customerId: user.uid,
        customerLocation: {
          latitude: coords.latitude,
          longitude: coords.longitude
        },
        imageUrl: dataUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });

      setIsUploading(false);
      navigation.replace('PrescriptionQuotes', { requestId: docRef.id });

    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert('Upload Failed', 'There was an error submitting your prescription. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Prescription</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instructionsTitle}>Valid Prescription Guide</Text>
        <Text style={styles.instructionsText}>
          • Ensure the image is clear and well-lit.{'\n'}
          • Doctor's details and signature should be visible.{'\n'}
          • Date of prescription must be clearly seen.
        </Text>

        <View style={styles.imageContainer}>
          {imageUri ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsZoomVisible(true)} activeOpacity={0.8}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <View style={styles.zoomHintOverlay}>
                <Text style={styles.zoomHintText}>Tap to View Full Screen</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder}>
              <FileUp color="#9CA3AF" size={48} />
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(true)}>
            <Camera color="#1E3A8A" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(false)}>
            <FileUp color="#1E3A8A" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitBtn, (!imageUri || !imageBase64 || isUploading) && { opacity: 0.6 }]} 
          onPress={handleUpload}
          disabled={!imageUri || !imageBase64 || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Submit to Pharmacies</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Full Screen Image Zoom Modal */}
      <Modal visible={isZoomVisible} transparent={true} animationType="fade" onRequestClose={() => setIsZoomVisible(false)}>
        <View style={styles.modalBackground}>
          <ImageViewer 
            imageUrls={[{ url: imageUri }]} 
            onCancel={() => setIsZoomVisible(false)}
            enableSwipeDown={true}
            renderIndicator={() => null}
            backgroundColor="transparent"
            style={{ width, height }}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setIsZoomVisible(false)}>
            <X color="#FFFFFF" size={28} />
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { flex: 1, padding: 24 },
  instructionsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  instructionsText: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 24 },
  imageContainer: { width: '100%', height: 300, backgroundColor: '#F3F4F6', borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', marginBottom: 24 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  zoomHintOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, alignItems: 'center' },
  zoomHintText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#9CA3AF', marginTop: 12, fontSize: 14, fontWeight: '500' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 0.48, flexDirection: 'row', backgroundColor: '#DBEAFE', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#1E3A8A', fontWeight: 'bold', fontSize: 14 },
  footer: { padding: 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#F3F4F6' },
  submitBtn: { backgroundColor: '#00C853', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  // Modal styles
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
});

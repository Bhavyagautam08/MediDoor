import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Camera, MapPin, ChevronLeft, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import { registerUser } from '../../services/authService';
import MapPickerModal from '../../components/MapPickerModal';
import CustomAlert from '../../components/CustomAlert';
import AnimatedLoader from '../../components/AnimatedLoader';

const uploadImageToStorage = async (uri, folderPath) => {
  if (!uri || uri.startsWith('http')) return uri;
  
  try {
    const filename = `file_${Date.now()}.jpg`;
    const bucket = storage.app.options.storageBucket;
    
    // Use Firebase REST API to bypass React Native Blob completely
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(folderPath + '/' + filename)}`;

    const response = await FileSystem.uploadAsync(uploadUrl, uri, {
      httpMethod: 'POST',
      uploadType: 0, // 0 = BINARY_CONTENT
      headers: {
        'Content-Type': 'image/jpeg',
      }
    });

    if (response.status !== 200) {
      throw new Error(`Server returned ${response.status}: ${response.body}`);
    }

    const data = JSON.parse(response.body);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(folderPath + '/' + filename)}?alt=media&token=${data.downloadTokens}`;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw new Error('Failed to upload image. Please check your internet connection and try again.');
  }
};

export default function SignUpScreen({ route, navigation }) {
  const selectedRole = route.params?.role || 'Customer';
  
  // Multi-step state
  const [step, setStep] = useState(1);

  // Basic Details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'error', buttons = []) => setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({...prev, visible: false}));

  // Pharmacy specific
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [licenseUri, setLicenseUri] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pharmacyLat, setPharmacyLat] = useState(null);
  const [pharmacyLng, setPharmacyLng] = useState(null);

  // Delivery Agent specific
  const [aadhaarUri, setAadhaarUri] = useState(null);
  const [panUri, setPanUri] = useState(null);
  const [dlUri, setDlUri] = useState(null);
  const [rcUri, setRcUri] = useState(null);
  const [insuranceUri, setInsuranceUri] = useState(null);
  const [bankUri, setBankUri] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleNextStep = () => {
    if (!name || !email || !phone || !password) {
      showAlert('Missing Fields', 'Please fill in all the basic details.');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      showAlert('Invalid Email', 'Please use a valid @gmail.com email address.');
      return;
    }
    if (password.length < 6) {
      showAlert('Weak Password', 'Password should be at least 6 characters long.');
      return;
    }
    
    // Go to step 2 for Delivery Agents
    setStep(2);
  };

  const handleRegister = async () => {
    // Validation for Pharmacy Admin and Customer (Step 1 submit)
    if (step === 1 && selectedRole !== 'Delivery Agent') {
      if (!name || !email || !phone || !password) {
        showAlert('Missing Fields', 'Please fill in all the basic details.');
        return;
      }
      if (!/^\d{10}$/.test(phone)) {
        showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
        return;
      }
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        showAlert('Invalid Email', 'Please use a valid @gmail.com email address.');
        return;
      }
      
      if (selectedRole === 'Pharmacy Admin') {
        if (!pharmacyName || !pharmacyAddress) {
          showAlert('Missing Fields', 'Please provide your Pharmacy Name and Address.');
          return;
        }
        if (!licenseUri) {
          showAlert('License Required', 'Please upload your pharmacy license to proceed. This is required for verification.');
          return;
        }
      }

      if (password.length < 6) {
        showAlert('Weak Password', 'Password should be at least 6 characters long.');
        return;
      }
    }

    // Validation for Delivery Agent (Step 2 submit)
    if (step === 2 && selectedRole === 'Delivery Agent') {
      if (!aadhaarUri || !panUri || !dlUri || !rcUri || !bankUri || !photoUri) {
        showAlert('Missing Documents', 'Please upload all the mandatory documents to proceed.');
        return;
      }
    }

    setLoading(true);
    try {
      const generatedId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const additionalData = { name, phone, medidoorId: generatedId };
      
      if (selectedRole === 'Pharmacy Admin') {
        if (!pharmacyLat || !pharmacyLng) {
          showAlert('Location Required', 'Please select your pharmacy location on the map.');
          setLoading(false);
          return;
        }

        // Upload Pharmacy License
        let uploadedLicenseUrl = '';
        if (licenseUri) {
          uploadedLicenseUrl = await uploadImageToStorage(licenseUri, 'pharmacy_licenses');
        }

        additionalData.name = pharmacyName;
        additionalData.ownerName = name;
        additionalData.address = pharmacyAddress;
        additionalData.latitude = pharmacyLat;
        additionalData.longitude = pharmacyLng;
        additionalData.licenseUrl = uploadedLicenseUrl;
        additionalData.status = 'pending'; // requires admin approval
      } else if (selectedRole === 'Delivery Agent') {
        // Upload all delivery agent documents concurrently
        const uploadedDocs = await Promise.all([
          uploadImageToStorage(aadhaarUri, 'delivery_documents/aadhaar'),
          uploadImageToStorage(panUri, 'delivery_documents/pan'),
          uploadImageToStorage(dlUri, 'delivery_documents/dl'),
          uploadImageToStorage(rcUri, 'delivery_documents/rc'),
          insuranceUri ? uploadImageToStorage(insuranceUri, 'delivery_documents/insurance') : Promise.resolve(null),
          uploadImageToStorage(bankUri, 'delivery_documents/bank'),
          uploadImageToStorage(photoUri, 'delivery_documents/photo')
        ]);

        additionalData.documents = {
          aadhaar: uploadedDocs[0],
          pan: uploadedDocs[1],
          dl: uploadedDocs[2],
          rc: uploadedDocs[3],
          insurance: uploadedDocs[4],
          bank: uploadedDocs[5],
          photo: uploadedDocs[6]
        };
        additionalData.status = 'pending'; // requires admin approval
      }
      
      await registerUser(email, password, selectedRole, additionalData);
      
      if (selectedRole === 'Pharmacy Admin' || selectedRole === 'Delivery Agent') {
        // Wait for admin approval
        showAlert(
          'Application Submitted! 🎉',
          `Your ${selectedRole === 'Pharmacy Admin' ? 'pharmacy' : 'delivery partner'} application has been submitted. Our team will review your documents and approve your account within 24-48 hours.`,
          'success',
          [{ text: 'OK', onPress: () => navigation.replace('UnderReview') }]
        );
      } else {
        showAlert('Success!', 'Your account has been created successfully.', 'success', [
          { 
            text: 'Get Started', 
            onPress: () => {
              if (selectedRole === 'Customer') {
                navigation.replace('CustomerRoot');
              } else {
                navigation.replace('RoleSelection');
              }
            } 
          }
        ]);
      }
    } catch (error) {
      let friendlyMessage = error.message;
      if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email is already registered! Please go to the Login screen.';
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = 'Your password is too weak. Please use at least 6 characters.';
      }
      showAlert('Registration Failed', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (setter) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission needed', 'Please allow access to your photo library to upload documents.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) {
        setter(result.assets[0].uri);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Could not pick image.');
    }
  };

  const takePhoto = async (setter) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission needed', 'Please allow access to your camera to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) {
        setter(result.assets[0].uri);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Could not take photo.');
    }
  };

  const DocumentUploader = ({ title, subtitle, uri, setUri, optional = false, useCameraOnly = false }) => (
    <View style={styles.inputGroup}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.label, { marginBottom: 0 }]}>{title} {optional ? '(Optional)' : '*'}</Text>
        {uri && <CheckCircle2 color="#10B981" size={16} style={{ marginLeft: 8 }} />}
      </View>
      {subtitle && <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>{subtitle}</Text>}
      <TouchableOpacity style={styles.licenseBox} onPress={() => useCameraOnly ? takePhoto(setUri) : pickImage(setUri)}>
        {uri ? (
          <Image source={{ uri }} style={styles.licensePreview} />
        ) : (
          <View style={styles.licensePlaceholder}>
            <Camera color="#6B7280" size={32} />
            <Text style={styles.licensePickerText}>{useCameraOnly ? 'Tap to open camera' : 'Tap to upload'}</Text>
            <Text style={styles.licensePickerSubText}>JPG, PNG • Clear photo required</Text>
          </View>
        )}
      </TouchableOpacity>
      {uri && (
        <TouchableOpacity onPress={() => setUri(null)} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Remove & Re-take</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          
          <LinearGradient colors={['#00C853', '#1565C0']} style={styles.header}>
            {step === 2 && (
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
                <ChevronLeft color="#FFFFFF" size={28} />
              </TouchableOpacity>
            )}
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/logo.jpeg')} style={{width: 64, height: 64, borderRadius: 16}} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{step === 1 ? 'Create Account' : 'Upload Documents'}</Text>
            <Text style={styles.subtitle}>
              {step === 1 
                ? `Join the MediDoor network as a ${selectedRole}` 
                : 'Mandatory verification documents'}
            </Text>
          </LinearGradient>

          <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            {step === 1 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{selectedRole === 'Pharmacy Admin' ? 'Owner Full Name' : 'Full Name'}</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter your name" 
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {selectedRole === 'Pharmacy Admin' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Pharmacy Name</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="e.g. Apollo Pharmacy" 
                        value={pharmacyName}
                        onChangeText={setPharmacyName}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Pharmacy Address</Text>
                      <TouchableOpacity 
                        style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }]} 
                        onPress={() => setShowMapPicker(true)}
                      >
                        <MapPin color="#6B7280" size={20} style={{ marginRight: 8 }} />
                        <Text style={{ flex: 1, color: pharmacyAddress ? '#111827' : '#9CA3AF' }} numberOfLines={2}>
                          {pharmacyAddress || "Select on map"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <DocumentUploader 
                      title="Pharmacy License / Registration Certificate"
                      subtitle="Required for verification. Upload a clear photo of your license."
                      uri={licenseUri}
                      setUri={setLicenseUri}
                    />
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="name@example.com" 
                    keyboardType="email-address" 
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="+91 98765 43210" 
                    keyboardType="phone-pad" 
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput 
                      style={styles.passwordInput} 
                      placeholder="Minimum 6 characters" 
                      secureTextEntry={!showPassword} 
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      {showPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.termsText}>
                  I agree to the Terms of Service and Privacy Policy
                </Text>

                <TouchableOpacity 
                  style={[styles.createButton, loading && { opacity: 0.7 }]}
                  onPress={selectedRole === 'Delivery Agent' ? handleNextStep : handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <AnimatedLoader color="#FFFFFF" size={24} />
                  ) : (
                    <Text style={styles.createButtonText}>
                      {selectedRole === 'Delivery Agent' ? 'Next' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.loginLink}>Login</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 2 && selectedRole === 'Delivery Agent' && (
              <>
                <DocumentUploader title="Aadhaar Card" uri={aadhaarUri} setUri={setAadhaarUri} />
                <DocumentUploader title="PAN Card" uri={panUri} setUri={setPanUri} />
                <DocumentUploader title="Driving Licence" uri={dlUri} setUri={setDlUri} />
                <DocumentUploader title="RC (Bike Registration)" uri={rcUri} setUri={setRcUri} />
                <DocumentUploader title="Bike Insurance" uri={insuranceUri} setUri={setInsuranceUri} optional={true} />
                <DocumentUploader title="Bank Account Details/Passbook" uri={bankUri} setUri={setBankUri} />
                <DocumentUploader 
                  title="Passport Size Photo" 
                  subtitle="Please take a real-time selfie. Gallery uploads are disabled for security."
                  uri={photoUri} 
                  setUri={setPhotoUri} 
                  useCameraOnly={true} 
                />
                
                <TouchableOpacity 
                  style={[styles.createButton, loading && { opacity: 0.7 }, { marginTop: 16 }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading ? (
                    <AnimatedLoader color="#FFFFFF" size={24} />
                  ) : (
                    <Text style={styles.createButtonText}>Submit Application</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

          </Animated.View>

          <Text style={styles.footerText}>MediDoor v3.0 • Secure Encryption</Text>

        </ScrollView>
      </KeyboardAvoidingView>
      
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelectLocation={(loc) => {
          setPharmacyAddress(loc.address);
          setPharmacyLat(loc.latitude);
          setPharmacyLng(loc.longitude);
          setShowMapPicker(false);
        }}
        initialLocation={{ address: pharmacyAddress, latitude: pharmacyLat, longitude: pharmacyLng }}
      />
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1 },
  header: { padding: 32, paddingBottom: 48, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, position: 'relative' },
  backButton: { position: 'absolute', top: 48, left: 24, zIndex: 10 },
  logoCircle: { width: 64, height: 64, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#E0E7FF' },
  formContainer: { padding: 24, marginTop: -20, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 16, fontSize: 14, backgroundColor: '#FFFFFF', color: '#111827' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  passwordInput: { flex: 1, padding: 16, fontSize: 14, color: '#111827' },
  eyeIcon: { padding: 16 },
  termsText: { textAlign: 'center', fontSize: 12, color: '#6B7280', marginVertical: 16 },
  createButton: { backgroundColor: '#00C853', paddingVertical: 16, borderRadius: 24, alignItems: 'center', marginHorizontal: 16 },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { color: '#6B7280', fontSize: 14 },
  loginLink: { color: '#00C853', fontSize: 14, fontWeight: 'bold' },
  footerText: { textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: 'auto', paddingBottom: 24 },
  licenseBox: { borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 12, overflow: 'hidden', minHeight: 140 },
  licensePreview: { width: '100%', height: 160, resizeMode: 'cover' },
  licensePlaceholder: { flex: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: 20 },
  licensePickerText: { color: '#374151', fontWeight: '600', fontSize: 14, marginTop: 10 },
  licensePickerSubText: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
});

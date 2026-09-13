import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Easing, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Mail, Phone, ShieldCheck, RefreshCw } from 'lucide-react-native';
import { collection, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../../firebaseConfig';
import AnimatedLoader from '../../components/AnimatedLoader';
import CustomAlert from '../../components/CustomAlert';

const functions = getFunctions(app);
const sendEmailOtpFn = httpsCallable(functions, 'sendEmailOtp');
const sendSmsOtpFn = httpsCallable(functions, 'sendSmsOtp');


export default function OtpLoginScreen({ navigation }) {
  const [method, setMethod] = useState(null);
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpDocId, setOtpDocId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info', buttons: [] });
  const showAlert = (title, message, type = 'error', buttons = []) => setAlertConfig({ visible: true, title, message, type, buttons });
  const hideAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    const trimmed = contact.trim().toLowerCase();
    if (!trimmed) {
      showAlert('Required', method === 'email' ? 'Please enter your email address.' : 'Please enter your phone number.');
      return;
    }
    if (method === 'email' && !trimmed.includes('@')) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (method === 'phone' && !/^\d{10}$/.test(trimmed.replace(/\s/g, ''))) {
      showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    try {
      if (method === 'email') {
        await sendEmailOtpFn({ email: trimmed });
        showAlert(
          'OTP Sent! 📧',
          `A 6-digit login code has been sent to ${contact}. Please check your inbox (and spam folder).`,
          'success',
          [{ text: 'Enter OTP', onPress: () => { setStep(2); setResendCooldown(60); } }]
        );
      } else {
        const cleanPhone = trimmed.replace(/\s/g, '');
        await sendSmsOtpFn({ phone: cleanPhone });
        showAlert(
          'OTP Sent! 📱',
          `A 6-digit login code has been sent via SMS to ${contact}.`,
          'success',
          [{ text: 'Enter OTP', onPress: () => { setStep(2); setResendCooldown(60); } }]
        );
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      const msg = error?.message?.includes('not-found') || error?.code === 'functions/not-found'
        ? 'OTP service not configured yet. Please contact support.'
        : `Could not send OTP: ${error.message || 'Please try again.'}`;
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };


  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length !== 6) {
      showAlert('Incomplete', 'Please enter all 6 digits of the OTP.');
      return;
    }

    setLoading(true);
    try {
      const trimmed = contact.trim().toLowerCase();
      const q = query(
        collection(db, 'otp_sessions'),
        where('contact', '==', trimmed),
        where('otp', '==', enteredOtp)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        showAlert('Invalid OTP', 'The code you entered is incorrect. Please try again.');
        setLoading(false);
        return;
      }

      const otpData = snap.docs[0].data();
      const expiresAt = otpData.expiresAt?.toDate();
      if (expiresAt && new Date() > expiresAt) {
        await deleteDoc(snap.docs[0].ref);
        showAlert('OTP Expired', 'This code has expired. Please request a new one.');
        setLoading(false);
        return;
      }

      // OTP valid — find user in Firestore
      const fieldName = method === 'email' ? 'email' : 'phone';
      const searchCollections = ['customers', 'pharmacies', 'delivery_agents'];

      let foundUser = null;
      let foundRole = null;

      for (const colName of searchCollections) {
        const userQuery = query(collection(db, colName), where(fieldName, '==', trimmed));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          foundUser = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
          if (colName === 'pharmacies') {
            const s = foundUser.status;
            foundRole = s === 'pending' ? 'PharmacyPending' : s === 'rejected' ? 'PharmacyRejected' : 'Pharmacy Admin';
          } else if (colName === 'delivery_agents') {
            foundRole = 'Delivery Agent';
          } else {
            foundRole = 'Customer';
          }
          break;
        }
      }

      // Clean up OTP
      await deleteDoc(snap.docs[0].ref);

      if (!foundUser) {
        showAlert('Account Not Found', `No account found with this ${method === 'email' ? 'email' : 'phone number'}. Please sign up first.`);
        setLoading(false);
        return;
      }

      // Navigate based on role
      if (foundRole === 'Customer') navigation.replace('CustomerRoot');
      else if (foundRole === 'Pharmacy Admin') navigation.replace('PharmacyRoot');
      else if (foundRole === 'PharmacyPending') navigation.replace('UnderReview');
      else if (foundRole === 'PharmacyRejected') navigation.replace('Rejected');
      else if (foundRole === 'Delivery Agent') navigation.replace('DeliveryRoot');
      else navigation.replace('RoleSelection');

    } catch (error) {
      console.error('Verify OTP error:', error);
      showAlert('Error', 'Could not verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <LinearGradient colors={['#003366', '#0D9494']} style={styles.header}>
            <TouchableOpacity
              onPress={() => step === 2 ? (setStep(1), setOtp(['','','','','',''])) : navigation.goBack()}
              style={styles.backBtn}
            >
              <ChevronLeft color="#FFFFFF" size={26} />
            </TouchableOpacity>
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/logo.png')} style={{ width: 72, height: 72, borderRadius: 18 }} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{step === 1 ? 'Login with OTP' : 'Verify Code'}</Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Choose how you want to receive your code'
                : `Code sent to your ${method === 'email' ? 'email' : 'phone'}`}
            </Text>
          </LinearGradient>

          <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {step === 1 && (
              <>
                <Text style={styles.sectionLabel}>Select Method</Text>
                <View style={styles.methodRow}>
                  <TouchableOpacity
                    style={[styles.methodCard, method === 'email' && styles.methodCardActive]}
                    onPress={() => { setMethod('email'); setContact(''); }}
                  >
                    <Mail color={method === 'email' ? '#FFFFFF' : '#003366'} size={26} />
                    <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>Email OTP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.methodCard, method === 'phone' && styles.methodCardActive]}
                    onPress={() => { setMethod('phone'); setContact(''); }}
                  >
                    <Phone color={method === 'phone' ? '#FFFFFF' : '#003366'} size={26} />
                    <Text style={[styles.methodText, method === 'phone' && styles.methodTextActive]}>Phone OTP</Text>
                  </TouchableOpacity>
                </View>

                {method && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{method === 'email' ? 'Email Address' : 'Phone Number'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={method === 'email' ? 'name@example.com' : '10-digit mobile number'}
                      keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                      value={contact}
                      onChangeText={setContact}
                    />
                  </View>
                )}

                {method && (
                  <TouchableOpacity
                    style={[styles.button, (!contact || loading) && { opacity: 0.55 }]}
                    onPress={handleSendOtp}
                    disabled={!contact || loading}
                  >
                    {loading
                      ? <AnimatedLoader color="#FFFFFF" size={22} />
                      : <Text style={styles.buttonText}>Send OTP</Text>}
                  </TouchableOpacity>
                )}

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.altBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.altBtnText}>Login with Password instead</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.otpSubLabel}>
                  Sent to <Text style={{ color: '#003366', fontWeight: '700' }}>{contact}</Text>
                </Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={ref => otpRefs.current[i] = ref}
                      style={[styles.otpBox, digit && styles.otpBoxFilled]}
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={t => handleOtpChange(t, i)}
                      onKeyPress={e => handleOtpKeyPress(e, i)}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.button, (otp.join('').length < 6 || loading) && { opacity: 0.55 }]}
                  onPress={handleVerifyOtp}
                  disabled={otp.join('').length < 6 || loading}
                >
                  {loading ? (
                    <AnimatedLoader color="#FFFFFF" size={22} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ShieldCheck color="#FFFFFF" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.buttonText}>Verify & Login</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resendBtn, resendCooldown > 0 && { opacity: 0.4 }]}
                  onPress={resendCooldown === 0 ? handleSendOtp : undefined}
                  disabled={resendCooldown > 0 || loading}
                >
                  <RefreshCw color="#003366" size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.resendText}>
                    {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
          <Text style={styles.footerText}>Axoro v3.0 • Secure OTP Login</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1 },
  header: {
    padding: 28, paddingBottom: 44, alignItems: 'center',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32, position: 'relative',
  },
  backBtn: {
    position: 'absolute', top: 48, left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  logoCircle: {
    width: 82, height: 82, backgroundColor: '#FFFFFF', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14, marginTop: 16,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: 20 },
  formContainer: { padding: 24, marginTop: -24, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 14, marginTop: 4 },
  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  methodCard: {
    flex: 1, borderWidth: 2, borderColor: '#003366', borderRadius: 16,
    paddingVertical: 22, alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF',
  },
  methodCardActive: { backgroundColor: '#003366', borderColor: '#003366' },
  methodText: { fontSize: 13, fontWeight: '700', color: '#003366' },
  methodTextActive: { color: '#FFFFFF' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 16, fontSize: 15, backgroundColor: '#FAFAFA', color: '#111827',
  },
  button: {
    backgroundColor: '#003366', paddingVertical: 16, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, marginTop: 4,
    shadowColor: '#003366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, color: '#9CA3AF', fontSize: 13 },
  altBtn: { alignItems: 'center', paddingVertical: 12 },
  altBtnText: { color: '#003366', fontSize: 14, fontWeight: '600' },
  otpSubLabel: { fontSize: 14, color: '#6B7280', marginBottom: 28, textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpBox: {
    width: 48, height: 58, borderWidth: 2, borderColor: '#D1D5DB', borderRadius: 14,
    fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', backgroundColor: '#F9FAFB',
  },
  otpBoxFilled: { borderColor: '#003366', backgroundColor: '#EFF6FF', color: '#003366' },
  resendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingVertical: 8 },
  resendText: { color: '#003366', fontSize: 14, fontWeight: '600' },
  footerText: { textAlign: 'center', fontSize: 10, color: '#9CA3AF', paddingBottom: 24, marginTop: 'auto' },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartPulse, Eye, EyeOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { loginUser } from '../../services/authService';
import AnimatedLoader from '../../components/AnimatedLoader';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

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

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const { role } = await loginUser(email, password);

      // Route based on role
      if (role === 'Customer') {
        navigation.replace('CustomerRoot');
      } else if (role === 'Pharmacy Admin') {
        navigation.replace('PharmacyRoot');
      } else if (role === 'Delivery Agent') {
        navigation.replace('DeliveryRoot');
      } else {
        navigation.replace('RoleSelection'); // Fallback
      }

    } catch (error) {
      let friendlyMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        friendlyMessage = 'Incorrect email or password. Please try again.';
      } else if (error.message.includes('not found in any database collection')) {
        friendlyMessage = 'Your account exists but role data is missing. Please contact support or create a new account.';
      } else if (error.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many failed attempts. Please try again later.';
      }

      Alert.alert('Login Failed', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your registered email address in the email field first.');
      return;
    }
    
    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Reset Email Sent', 'If an account with this email exists, a password reset link has been sent to it.');
    } catch (error) {
      let friendlyMessage = 'Failed to send reset email. Please try again.';
      if (error.code === 'auth/invalid-email') friendlyMessage = 'Please enter a valid email address.';
      else if (error.code === 'auth/user-not-found') friendlyMessage = 'No account found with this email.';
      
      Alert.alert('Error', friendlyMessage);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <LinearGradient colors={['#1565C0', '#00C853']} style={styles.header}>
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/logo.jpeg')} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login to access your account</Text>
          </LinearGradient>

          <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} disabled={resettingPassword}>
                {resettingPassword ? (
                  <AnimatedLoader color="#1565C0" size={14} />
                ) : (
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <AnimatedLoader color="#FFFFFF" size={24} />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>New user? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('RoleSelection')}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Text style={styles.footerText}>MediDoor v3.0 • Secure Login</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1 },
  header: { padding: 32, paddingBottom: 48, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoCircle: { width: 64, height: 64, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#E0E7FF' },
  formContainer: { padding: 24, marginTop: -20, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 16, fontSize: 14, backgroundColor: '#FFFFFF', color: '#111827' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#FFFFFF' },
  passwordInput: { flex: 1, padding: 16, fontSize: 14, color: '#111827' },
  eyeIcon: { padding: 16 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 12 },
  forgotText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
  button: { backgroundColor: '#1565C0', paddingVertical: 16, borderRadius: 24, alignItems: 'center', marginHorizontal: 16, marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  signupText: { color: '#6B7280', fontSize: 14 },
  signupLink: { color: '#1565C0', fontSize: 14, fontWeight: 'bold' },
  footerText: { textAlign: 'center', fontSize: 10, color: '#9CA3AF', marginTop: 'auto', paddingBottom: 24 }
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, ShieldCheck, FileUp, MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient'; // Need to install expo-linear-gradient

export default function IntroScreen({ navigation }) {
  const services = [
    { title: 'Fast Delivery', icon: Zap },
    { title: 'Trusted Pharmacies', icon: ShieldCheck },
    { title: 'Prescription Upload', icon: FileUp },
    { title: 'Live Tracking', icon: MapPin },
  ];

  return (
    <View style={styles.container}>
      {/* Top Gradient Area */}
      <LinearGradient colors={['#003366', '#0D9494']} style={styles.topSection}>
        <View style={styles.logoIcon}>
          <Image source={require('../../../assets/logo.png')} style={{width: 64, height: 64, borderRadius: 16}} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Axoro</Text>
        <Text style={styles.subtitle}>Medicines Delivered to Your Doorstep</Text>
      </LinearGradient>

      {/* Bottom White Area */}
      <View style={styles.bottomSection}>
        <Text style={styles.servicesTitle}>Our Services</Text>
        
        <View style={styles.grid}>
          {services.map((s, i) => (
            <View key={i} style={styles.serviceCard}>
              <s.icon color="#003366" size={24} style={styles.serviceIcon} />
              <Text style={styles.serviceText}>{s.title}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.signupButton}
          onPress={() => navigation.navigate('RoleSelection')}
        >
          <Text style={styles.signupText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  topSection: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoIcon: { backgroundColor: '#FFFFFF', width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#111827', opacity: 0.8 },
  bottomSection: { backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 40, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  servicesTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', alignSelf: 'center', marginBottom: 24, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 32 },
  serviceCard: { width: '48%', backgroundColor: '#F9FAFB', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  serviceIcon: { marginBottom: 12 },
  serviceText: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  signupButton: { backgroundColor: '#0D9494', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signupText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});

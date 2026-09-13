import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Building, Truck } from 'lucide-react-native';

export default function RoleSelectionScreen({ navigation, onRoleSelected }) {
  const [selectedRole, setSelectedRole] = useState(null);

  const roles = [
    { id: 'Customer',       title: 'Customer',          desc: 'Order medicines for home delivery',  icon: User,     color: '#E8F5E9', iconColor: '#212121' },
    { id: 'Pharmacy Admin', title: 'Pharmacy Partner',  desc: 'Manage orders and inventory',         icon: Building, color: '#E3F2FD', iconColor: '#003366' },
    { id: 'Delivery Agent', title: 'Delivery Partner',  desc: 'Earn by delivering medicines',         icon: Truck,    color: '#FFF3E0', iconColor: '#E65100' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerArea}>
        <View style={styles.iconBox}>
          <Image 
            source={require('../../../assets/logo.png')} 
            style={{ width: 60, height: 60, borderRadius: 16 }} 
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to Axoro</Text>
        <Text style={styles.subtitle}>How will you use Axoro?</Text>
      </View>

      <View style={styles.content}>
        {roles.map((r) => (
          <TouchableOpacity 
            key={r.id} 
            style={[styles.roleCard, selectedRole === r.id && styles.selectedCard]}
            onPress={() => setSelectedRole(r.id)}
          >
            <View style={[styles.cardIconBox, { backgroundColor: r.color }]}>
              <r.icon color={r.iconColor} size={24} />
            </View>
            <View style={styles.cardTextCol}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.cardDesc}>{r.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.continueButton}
          onPress={() => {
            if(selectedRole) {
              navigation.navigate('SignUp', { role: selectedRole });
            }
          }}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerArea: { backgroundColor: '#E8F5E9', alignItems: 'center', padding: 32, paddingBottom: 48, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  iconBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#111827', fontWeight: '500' },
  content: { padding: 24, marginTop: -24 },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: 'transparent' },
  selectedCard: { borderColor: '#0D9494', backgroundColor: '#FFFFFF' },
  cardIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  cardTextCol: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#6B7280' },
  footer: { padding: 24, backgroundColor: '#F3F4F6', marginTop: 'auto' },
  continueButton: { backgroundColor: '#0D9494', borderRadius: 24, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginText: { color: '#6B7280', fontSize: 14 },
  loginLink: { color: '#0D9494', fontSize: 14, fontWeight: 'bold' }
});

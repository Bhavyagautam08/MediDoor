import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Settings, Save, ChevronLeft, ShieldCheck, Truck, Percent } from 'lucide-react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    baseDeliveryFee: '0',
    platformCommission: '15',
    subscriptionsEnabled: false,
    promoCodesEnabled: false,
    haltOrders: false,
    surgePricing: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'app_features');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          baseDeliveryFee: data.baseDeliveryFee?.toString() || '0',
          platformCommission: data.platformCommission?.toString() || '15',
          subscriptionsEnabled: !!data.subscriptionsEnabled,
          promoCodesEnabled: !!data.promoCodesEnabled,
          haltOrders: !!data.haltOrders,
          surgePricing: !!data.surgePricing
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'app_features');
      await setDoc(docRef, {
        baseDeliveryFee: parseFloat(settings.baseDeliveryFee) || 0,
        platformCommission: parseFloat(settings.platformCommission) || 0,
        subscriptionsEnabled: settings.subscriptionsEnabled,
        promoCodesEnabled: settings.promoCodesEnabled,
        haltOrders: settings.haltOrders,
        surgePricing: settings.surgePricing
      }, { merge: true });
      Alert.alert(
        "Success", 
        "Settings have been updated across the platform.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Could not save settings.");
    }
    setSaving(false);
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
        <Text style={styles.title}>Global Settings</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        >
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save color="#FFFFFF" size={20} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Configurations</Text>
          <Text style={styles.sectionSubtitle}>These values determine the flow of money in the marketplace.</Text>
          
          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <Percent color="#64748B" size={20} />
              <Text style={styles.inputLabel}>Platform Commission (%)</Text>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={settings.platformCommission}
              onChangeText={(text) => setSettings(prev => ({ ...prev, platformCommission: text }))}
            />
            <Text style={styles.helperText}>This is the % cut Medidoor takes from Pharmacy sales.</Text>
          </View>

          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <Truck color="#64748B" size={20} />
              <Text style={styles.inputLabel}>Base Delivery Fee (₹)</Text>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={settings.baseDeliveryFee}
              onChangeText={(text) => setSettings(prev => ({ ...prev, baseDeliveryFee: text }))}
            />
            <Text style={styles.helperText}>The minimum fee charged to the Customer for delivery.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Flags</Text>
          <Text style={styles.sectionSubtitle}>Turn features ON or OFF instantly on the User App.</Text>
          
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.switchLabel}>Enable Subscriptions</Text>
              <Text style={styles.switchHelper}>Allows customers to set up monthly refills</Text>
            </View>
            <Switch
              value={settings.subscriptionsEnabled}
              onValueChange={(val) => setSettings(prev => ({ ...prev, subscriptionsEnabled: val }))}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
          
          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.switchLabel}>Enable Promo Codes</Text>
              <Text style={styles.switchHelper}>Allows customers to apply discounts at checkout</Text>
            </View>
            <Switch
              value={settings.promoCodesEnabled}
              onValueChange={(val) => setSettings(prev => ({ ...prev, promoCodesEnabled: val }))}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>Emergency Controls</Text>
          <Text style={styles.sectionSubtitle}>Use these settings in case of high demand or system issues.</Text>
          
          <View style={[styles.switchRow, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.switchLabel, { color: '#DC2626' }]}>Halt New Orders</Text>
              <Text style={styles.switchHelper}>Temporarily stop accepting any new customer orders.</Text>
            </View>
            <Switch
              value={settings.haltOrders}
              onValueChange={(val) => setSettings(prev => ({ ...prev, haltOrders: val }))}
              trackColor={{ false: '#CBD5E1', true: '#DC2626' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={[styles.switchRow, { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.switchLabel, { color: '#D97706' }]}>Enable Surge Pricing</Text>
              <Text style={styles.switchHelper}>Apply a dynamic multiplier to delivery fees during peak hours.</Text>
            </View>
            <Switch
              value={settings.surgePricing}
              onValueChange={(val) => setSettings(prev => ({ ...prev, surgePricing: val }))}
              trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  switchHelper: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  divider: {
    height: 12,
  }
});

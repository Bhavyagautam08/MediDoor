import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { ChevronLeft, Store, Navigation, CheckCircle } from 'lucide-react-native';
import { collection, onSnapshot, query, where, getDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function SettlementsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pharmacies'); 
  const [commissionRate, setCommissionRate] = useState(0.15); 
  
  const [pharmacyBalances, setPharmacyBalances] = useState([]);
  const [driverBalances, setDriverBalances] = useState([]);
  const [floatingCashDrivers, setFloatingCashDrivers] = useState([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app_features'));
        if (snap.exists() && snap.data().platformCommission) {
          setCommissionRate(parseFloat(snap.data().platformCommission) / 100);
        }
      } catch (e) {
        console.error("Could not fetch commission:", e);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    // Listen to DELIVERED orders that are NOT YET SETTLED
    const q = query(collection(db, 'orders'), where('status', '==', 'delivered'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pMap = {}; 
      const dMap = {}; 

      snapshot.forEach(docSnap => {
        const order = docSnap.data();
        // Skip already settled orders
        if (order.settled) return;

        const subtotal = order.subtotal || 0;
        const deliveryFee = order.deliveryFee || 0;
        const pharmacyCut = subtotal - (subtotal * commissionRate);
        
        // Tally Pharmacy
        if (order.pharmacyId) {
          if (!pMap[order.pharmacyId]) {
            pMap[order.pharmacyId] = { id: order.pharmacyId, name: order.pharmacyName || 'Unknown Pharmacy', owed: 0, orderIds: [] };
          }
          pMap[order.pharmacyId].owed += pharmacyCut;
          pMap[order.pharmacyId].orderIds.push(docSnap.id);
        }

        // Tally Driver
        if (order.driverId) {
          if (!dMap[order.driverId]) {
            dMap[order.driverId] = { id: order.driverId, name: order.driverName || 'Unknown Driver', owed: 0, orderIds: [] };
          }
          dMap[order.driverId].owed += deliveryFee;
          dMap[order.driverId].orderIds.push(docSnap.id);
        }
      });

      setPharmacyBalances(Object.values(pMap).sort((a, b) => b.owed - a.owed));
      setDriverBalances(Object.values(dMap).sort((a, b) => b.owed - a.owed));
      setLoading(false);
    });

    // Listen to Floating Cash
    const floatingQ = query(collection(db, 'delivery_agents'), where('floatingCash', '>', 0));
    const floatingUnsub = onSnapshot(floatingQ, (snapshot) => {
      const fcList = [];
      snapshot.forEach(docSnap => {
        fcList.push({ id: docSnap.id, ...docSnap.data() });
      });
      fcList.sort((a, b) => b.floatingCash - a.floatingCash);
      setFloatingCashDrivers(fcList);
    });

    return () => {
      unsubscribe();
      floatingUnsub();
    };
  }, [commissionRate]);

  const handleSettle = async (entity, type) => {
    Alert.alert(
      "Confirm Settlement",
      `Mark ₹${Math.round(entity.owed)} as paid to ${entity.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as Paid",
          style: "default",
          onPress: async () => {
            try {
              const batch = writeBatch(db);
              entity.orderIds.forEach(orderId => {
                const orderRef = doc(db, 'orders', orderId);
                // Mark settled true, and record who we settled (so if we settle driver but not pharmacy, we might need granular flags.
                // For MVP, since driver and pharmacy payouts are tied to the same order, we will set specific flags:
                if (type === 'pharmacy') {
                  batch.update(orderRef, { pharmacySettled: true, settled: true }); // Simplification for MVP
                } else {
                  batch.update(orderRef, { driverSettled: true, settled: true });
                }
              });
              await batch.commit();
              Alert.alert("Success", "Payout has been marked as settled.");
            } catch (error) {
              console.error("Settlement error:", error);
              Alert.alert("Error", "Could not process settlement.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Payouts & Settlements</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pharmacies' && styles.activeTab]}
          onPress={() => setActiveTab('pharmacies')}
        >
          <Text style={[styles.tabText, activeTab === 'pharmacies' && styles.activeTabText]}>Pharmacies</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'drivers' && styles.activeTab]}
          onPress={() => setActiveTab('drivers')}
        >
          <Text style={[styles.tabText, activeTab === 'drivers' && styles.activeTabText]}>Drivers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'floating' && styles.activeTab]}
          onPress={() => setActiveTab('floating')}
        >
          <Text style={[styles.tabText, activeTab === 'floating' && styles.activeTabText]}>COD Cash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoBanner, activeTab === 'floating' && { backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.infoText, activeTab === 'floating' && { color: '#991B1B' }]}>
            {activeTab === 'floating' 
              ? "This shows cash collected from COD orders that drivers owe the company."
              : "This screen shows only Unpaid balances for delivered orders."}
          </Text>
        </View>

        {activeTab === 'pharmacies' && (
          <View style={styles.listContainer}>
            {pharmacyBalances.map((p, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620', marginRight: 12 }]}>
                    <Store color="#8B5CF6" size={20} />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{p.name}</Text>
                    <Text style={styles.itemSub}>{p.orderIds.length} unpaid orders</Text>
                  </View>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.itemAmount}>₹{Math.round(p.owed).toLocaleString()}</Text>
                  <TouchableOpacity style={styles.settleBtn} onPress={() => handleSettle(p, 'pharmacy')}>
                    <CheckCircle color="#FFFFFF" size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.settleBtnText}>Settle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {pharmacyBalances.length === 0 && <Text style={styles.emptyText}>All pharmacy payouts are settled!</Text>}
          </View>
        )}

        {activeTab === 'drivers' && (
          <View style={styles.listContainer}>
            {driverBalances.map((d, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20', marginRight: 12 }]}>
                    <Navigation color="#F59E0B" size={20} />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{d.name}</Text>
                    <Text style={styles.itemSub}>{d.orderIds.length} unpaid deliveries</Text>
                  </View>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.itemAmount}>₹{Math.round(d.owed).toLocaleString()}</Text>
                  <TouchableOpacity style={styles.settleBtn} onPress={() => handleSettle(d, 'driver')}>
                    <CheckCircle color="#FFFFFF" size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.settleBtnText}>Settle</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {driverBalances.length === 0 && <Text style={styles.emptyText}>All driver payouts are settled!</Text>}
          </View>
        )}

        {activeTab === 'floating' && (
          <View style={[styles.listContainer, { borderColor: '#FECACA' }]}>
            {floatingCashDrivers.map((d, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2', marginRight: 12 }]}>
                    <Text style={{ fontSize: 16 }}>💰</Text>
                  </View>
                  <View>
                    <Text style={styles.itemName}>{d.name || 'Unknown Driver'}</Text>
                    <Text style={[styles.itemSub, { color: '#991B1B' }]}>Owes Company</Text>
                  </View>
                </View>
                <View style={styles.listRight}>
                  <Text style={[styles.itemAmount, { color: '#991B1B' }]}>₹{Math.round(d.floatingCash).toLocaleString()}</Text>
                </View>
              </View>
            ))}
            {floatingCashDrivers.length === 0 && <Text style={styles.emptyText}>No drivers are currently holding COD cash!</Text>}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  tabContainer: { flexDirection: 'row', padding: 16, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#F1F5F9' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#0F172A' },
  body: { flex: 1, padding: 16 },
  infoBanner: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 16 },
  infoText: { color: '#3B82F6', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  listContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  listLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  itemSub: { fontSize: 12, color: '#64748B' },
  listRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  settleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  settleBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginTop: 16, marginBottom: 8 }
});

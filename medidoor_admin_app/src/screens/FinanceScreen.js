import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { IndianRupee, Store, Navigation, Activity, CheckCircle, TrendingUp, Wallet } from 'lucide-react-native';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const FinanceCard = ({ title, amount, icon: Icon, color, subtitle }) => (
  <View style={[styles.card, { borderTopColor: color, borderTopWidth: 4 }]}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Icon color={color} size={20} />
      </View>
    </View>
    <Text style={styles.cardAmount}>₹{amount.toLocaleString()}</Text>
    {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
  </View>
);

export default function FinanceScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'pharmacies', 'drivers'
  const [commissionRate, setCommissionRate] = useState(0.15); // Default 15%
  
  const [summary, setSummary] = useState({
    medidoorRevenue: 0,
    pharmacyOwed: 0,
    driverOwed: 0,
    totalProcessed: 0
  });

  const [pharmacyBalances, setPharmacyBalances] = useState([]);
  const [driverBalances, setDriverBalances] = useState([]);

  useEffect(() => {
    // 1. Fetch Global Settings to get true commission rate
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
    // 2. Listen to DELIVERED orders
    const q = query(collection(db, 'orders'), where('status', '==', 'delivered'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let medidoorTotal = 0;
      let totalValue = 0;
      
      const pMap = {}; // Pharmacy ID -> { name, owed }
      const dMap = {}; // Driver ID -> { name, owed }

      snapshot.forEach(doc => {
        const order = doc.data();
        const subtotal = order.subtotal || 0;
        const deliveryFee = order.deliveryFee || 0;
        
        totalValue += (order.totalAmount || 0);

        // Medidoor takes commission from the subtotal (medicine cost)
        const medidoorCut = subtotal * commissionRate;
        const pharmacyCut = subtotal - medidoorCut;
        
        medidoorTotal += medidoorCut;

        // Tally Pharmacy
        if (order.pharmacyId) {
          if (!pMap[order.pharmacyId]) {
            pMap[order.pharmacyId] = { name: order.pharmacyName || 'Unknown Pharmacy', owed: 0, orderCount: 0 };
          }
          pMap[order.pharmacyId].owed += pharmacyCut;
          pMap[order.pharmacyId].orderCount += 1;
        }

        // Tally Driver (Gets 100% of delivery fee)
        if (order.driverId) {
          if (!dMap[order.driverId]) {
            dMap[order.driverId] = { name: order.driverName || 'Unknown Driver', owed: 0, orderCount: 0 };
          }
          dMap[order.driverId].owed += deliveryFee;
          dMap[order.driverId].orderCount += 1;
        }
      });

      // Convert maps to sorted arrays
      const pArray = Object.values(pMap).sort((a, b) => b.owed - a.owed);
      const dArray = Object.values(dMap).sort((a, b) => b.owed - a.owed);
      
      const pharmacyTotalOwed = pArray.reduce((acc, p) => acc + p.owed, 0);
      const driverTotalOwed = dArray.reduce((acc, d) => acc + d.owed, 0);

      setSummary({
        medidoorRevenue: Math.round(medidoorTotal),
        pharmacyOwed: Math.round(pharmacyTotalOwed),
        driverOwed: Math.round(driverTotalOwed),
        totalProcessed: Math.round(totalValue)
      });
      setPharmacyBalances(pArray);
      setDriverBalances(dArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [commissionRate]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Finance</Text>
          <Text style={styles.subtitle}>Revenue & payouts</Text>
        </View>
        <TouchableOpacity 
          style={styles.settlementsBtn}
          onPress={() => navigation.navigate('Settlements')}
        >
          <Wallet color="#FFFFFF" size={16} />
          <Text style={styles.settlementsBtnText}>Settlements</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>Summary</Text>
        </TouchableOpacity>
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
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        
        {activeTab === 'summary' && (
          <View>
            <View style={styles.mainHighlight}>
              <View style={styles.highlightHeader}>
                <TrendingUp color="#10B981" size={24} />
                <Text style={styles.highlightTitle}>Medidoor Net Revenue</Text>
              </View>
              <Text style={styles.highlightAmount}>₹{summary.medidoorRevenue.toLocaleString()}</Text>
              <Text style={styles.highlightSubtitle}>Based on {commissionRate * 100}% platform commission</Text>
            </View>

            <View style={styles.grid}>
              <FinanceCard 
                title="Total Processed" 
                amount={summary.totalProcessed} 
                icon={Activity} 
                color="#3B82F6"
                subtitle="All time Gross Merchandise Value" 
              />
              <FinanceCard 
                title="Owed to Pharmacies" 
                amount={summary.pharmacyOwed} 
                icon={Store} 
                color="#8B5CF6"
                subtitle={`Across ${pharmacyBalances.length} partners`} 
              />
              <FinanceCard 
                title="Owed to Drivers" 
                amount={summary.driverOwed} 
                icon={Navigation} 
                color="#F59E0B"
                subtitle={`Across ${driverBalances.length} partners`} 
              />
            </View>
          </View>
        )}

        {activeTab === 'pharmacies' && (
          <View style={styles.listContainer}>
            <Text style={styles.listHeader}>Outstanding Pharmacy Payouts</Text>
            {pharmacyBalances.map((p, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#8B5CF620', marginRight: 12 }]}>
                    <Store color="#8B5CF6" size={20} />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{p.name}</Text>
                    <Text style={styles.itemSub}>{p.orderCount} orders delivered</Text>
                  </View>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.itemAmount}>₹{Math.round(p.owed).toLocaleString()}</Text>
                </View>
              </View>
            ))}
            {pharmacyBalances.length === 0 && (
              <Text style={styles.emptyText}>No pharmacy payouts pending.</Text>
            )}
          </View>
        )}

        {activeTab === 'drivers' && (
          <View style={styles.listContainer}>
            <Text style={styles.listHeader}>Outstanding Driver Payouts</Text>
            {driverBalances.map((d, idx) => (
              <View key={idx} style={styles.listItem}>
                <View style={styles.listLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20', marginRight: 12 }]}>
                    <Navigation color="#F59E0B" size={20} />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{d.name}</Text>
                    <Text style={styles.itemSub}>{d.orderCount} deliveries completed</Text>
                  </View>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.itemAmount}>₹{Math.round(d.owed).toLocaleString()}</Text>
                </View>
              </View>
            ))}
            {driverBalances.length === 0 && (
              <Text style={styles.emptyText}>No driver payouts pending.</Text>
            )}
          </View>
        )}

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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  settlementsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  settlementsBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#F1F5F9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0F172A',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  mainHighlight: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  highlightTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  highlightAmount: {
    color: '#10B981',
    fontSize: 40,
    fontWeight: 'bold',
  },
  highlightSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  listHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 12,
    color: '#64748B',
  },
  listRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Users, Store, ShoppingBag, TrendingUp, Settings, Megaphone, MonitorPlay } from 'lucide-react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const StatCard = ({ title, value, icon: Icon, color, onPress }) => (
  <TouchableOpacity 
    style={[styles.card, { borderLeftColor: color }]}
    onPress={onPress}
  >
    <View style={{ flex: 1, paddingRight: 8 }}>
      <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
    <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
      <Icon color={color} size={24} />
    </View>
  </TouchableOpacity>
);

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({
    revenue: 0,
    totalOrders: 0,
    pharmacies: 0,
    users: 0,
  });
  const [pendingApprovals, setPendingApprovals] = useState({ pharmacies: 0, partners: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Orders (Revenue & Active Orders)
    const ordersUnsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      let totalRevenue = 0;
      let activeCount = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'delivered' || data.status === 'Delivered') {
          const sub = Number(data.subtotal || 0);
          const del = Number(data.deliveryFee || 0);
          const serv = Number(data.serviceFee || 15);
          const commRate = Number(data.platformCommission || 15) / 100;
          const pCut = del ? Math.max(30, Math.floor(del * 0.8)) : 0;
          
          totalRevenue += serv + (del - pCut) + (sub * commRate);
        }
      });
      
      setStats(prev => ({ ...prev, revenue: totalRevenue, totalOrders: snapshot.size }));
    });

    // 2. Listen to Pharmacies
    const pharmaciesUnsub = onSnapshot(collection(db, 'pharmacies'), (snapshot) => {
      setStats(prev => ({ ...prev, pharmacies: snapshot.size }));
    });

    // 3. Listen to Customers
    const customersUnsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setStats(prev => ({ ...prev, users: snapshot.size }));
      setLoading(false); // Stop loading when all listeners are attached and have initial data
    });

    // 4. Listen to Pending Approvals
    const pendingPharmaciesUnsub = onSnapshot(
      query(collection(db, 'pharmacies'), where('status', '==', 'pending')),
      (snapshot) => setPendingApprovals(prev => ({ ...prev, pharmacies: snapshot.size }))
    );
    const pendingPartnersUnsub = onSnapshot(
      query(collection(db, 'delivery_agents'), where('status', '==', 'pending')),
      (snapshot) => setPendingApprovals(prev => ({ ...prev, partners: snapshot.size }))
    );

    return () => {
      ordersUnsub();
      pharmaciesUnsub();
      customersUnsub();
      pendingPharmaciesUnsub();
      pendingPartnersUnsub();
    };
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, Admin 👋</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={[styles.settingsBtn, { marginRight: 8 }]}
            onPress={() => navigation.navigate('Advertisements')}
          >
            <MonitorPlay color="#8B5CF6" size={22} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.settingsBtn, { marginRight: 8 }]}
            onPress={() => navigation.navigate('SendNotification')}
          >
            <Megaphone color="#3B82F6" size={22} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings color="#64748B" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <StatCard title="Platform Revenue" value={`₹${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={TrendingUp} color="#10B981" onPress={() => navigation.navigate('DashboardRevenue')} />
          <StatCard title="Total Orders" value={stats.totalOrders.toString()} icon={ShoppingBag} color="#3B82F6" onPress={() => navigation.navigate('DashboardOrders')} />
          <StatCard title="Pharmacies" value={stats.pharmacies.toString()} icon={Store} color="#8B5CF6" onPress={() => navigation.navigate('DashboardPharmacies')} />
          <StatCard title="Total Users" value={stats.users.toString()} icon={Users} color="#F59E0B" onPress={() => navigation.navigate('DashboardUsers')} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Action Required: Approvals</Text>
        
        {pendingApprovals.pharmacies === 0 && pendingApprovals.partners === 0 ? (
          <View style={styles.activityCard}>
            <Text style={styles.emptyText}>You're all caught up! No pending approvals.</Text>
          </View>
        ) : (
          <View>
            {pendingApprovals.pharmacies > 0 && (
              <TouchableOpacity 
                style={styles.approvalActionCard} 
                onPress={() => navigation.navigate('Search', { initialTab: 'pharmacies' })}
              >
                <View style={styles.approvalActionLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2', marginRight: 12 }]}>
                    <Store color="#EF4444" size={24} />
                  </View>
                  <View>
                    <Text style={styles.approvalActionTitle}>Pharmacies</Text>
                    <Text style={styles.approvalActionDesc}>{pendingApprovals.pharmacies} require your approval</Text>
                  </View>
                </View>
                <View style={styles.approvalActionBadge}>
                  <Text style={styles.approvalActionBadgeText}>Review</Text>
                </View>
              </TouchableOpacity>
            )}

            {pendingApprovals.partners > 0 && (
              <TouchableOpacity 
                style={[styles.approvalActionCard, { marginTop: pendingApprovals.pharmacies > 0 ? 12 : 0 }]} 
                onPress={() => navigation.navigate('Search', { initialTab: 'partners' })}
              >
                <View style={styles.approvalActionLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7', marginRight: 12 }]}>
                    <Users color="#F59E0B" size={24} />
                  </View>
                  <View>
                    <Text style={styles.approvalActionTitle}>Delivery Partners</Text>
                    <Text style={styles.approvalActionDesc}>{pendingApprovals.partners} require your approval</Text>
                  </View>
                </View>
                <View style={styles.approvalActionBadge}>
                  <Text style={styles.approvalActionBadgeText}>Review</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsBtn: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  date: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    padding: 16,
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
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  approvalActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  approvalActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approvalActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  approvalActionDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  approvalActionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  approvalActionBadgeText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 13,
  }
});

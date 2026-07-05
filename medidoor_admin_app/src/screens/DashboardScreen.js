import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Users, Store, ShoppingBag, TrendingUp } from 'lucide-react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <View style={[styles.card, { borderLeftColor: color }]}>
    <View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
    <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
      <Icon color={color} size={24} />
    </View>
  </View>
);

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    revenue: 0,
    activeOrders: 0,
    pharmacies: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to Orders (Revenue & Active Orders)
    const ordersUnsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      let totalRevenue = 0;
      let activeCount = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'delivered') {
          totalRevenue += (data.totalAmount || 0);
        } else if (data.status !== 'cancelled' && data.status !== 'cancel') {
          activeCount++;
        }
      });
      
      setStats(prev => ({ ...prev, revenue: totalRevenue, activeOrders: activeCount }));
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

    return () => {
      ordersUnsub();
      pharmaciesUnsub();
      customersUnsub();
    };
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Overview</Text>
        <Text style={styles.subtitle}>Welcome back, here's what's happening</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <StatCard title="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} icon={TrendingUp} color="#10B981" />
          <StatCard title="Active Orders" value={stats.activeOrders.toString()} icon={ShoppingBag} color="#3B82F6" />
          <StatCard title="Pharmacies" value={stats.pharmacies.toString()} icon={Store} color="#8B5CF6" />
          <StatCard title="Total Users" value={stats.users.toString()} icon={Users} color="#F59E0B" />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <Text style={styles.emptyText}>No recent activity to display.</Text>
        </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
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
  }
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { User, LogOut, Bike, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { calculateDistance } from '../../utils/distance';

const getEarning = (order) => {
  if (order.pharmacyLocation && order.customerLocation) {
    const dist = calculateDistance(order.pharmacyLocation, order.customerLocation);
    return Math.max(30, Math.floor(20 + (dist * 10)));
  }
  return order.deliveryFee ? Math.max(30, Math.floor(order.deliveryFee * 0.8)) : 40;
};

export default function DeliveryProfileScreen({ navigation }) {
  const [profileData, setProfileData] = useState(null);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [averageRating, setAverageRating] = useState('New');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const [snap, ordersSnap] = await Promise.all([
          getDoc(doc(db, 'delivery_agents', currentUser.uid)),
          getDocs(query(collection(db, 'orders'), where('riderId', '==', currentUser.uid), where('status', '==', 'Delivered')))
        ]);

        if (snap.exists()) {
          setProfileData({ ...snap.data(), email: currentUser.email });
        } else {
          setProfileData({ email: currentUser.email, name: 'Delivery Agent' });
        }
        setTotalDeliveries(ordersSnap.size);

        let totalRating = 0;
        let ratingCount = 0;
        let earned = 0;
        ordersSnap.forEach(docSnap => {
          const d = docSnap.data();
          const rating = d.deliveryRating;
          if (typeof rating === 'number') {
            totalRating += rating;
            ratingCount++;
          }
          earned += getEarning(d);
        });
        setTotalEarnings(earned);
        setAverageRating(ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 'New');
      } catch (err) {
        console.error(err); Alert.alert("Error", String(err || "An unexpected error occurred"));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive', onPress: async () => {
          await auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF9800" />
      </SafeAreaView>
    );
  }

  const initials = (profileData?.name || 'D').substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#FF9800', '#E65100']} style={styles.headerBg}>
        <View style={styles.headerContent}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.riderName}>{profileData?.name || 'Delivery Agent'}</Text>
          <Text style={styles.riderEmail}>{profileData?.email}</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalDeliveries}</Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{totalEarnings}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{averageRating}{averageRating !== 'New' ? ' ★' : ''}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <User color="#6B7280" size={20} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{profileData?.name || '—'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Bike color="#6B7280" size={20} />
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Vehicle Type</Text>
              <Text style={styles.infoValue}>{profileData?.vehicle || 'Two-Wheeler (Bike/Scooter)'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 20 }}>📱</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>{profileData?.phone || '+91 - Not provided'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 20 }}>📅</Text>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Joined On</Text>
              <Text style={styles.infoValue}>
                {profileData?.createdAt
                  ? new Date(profileData.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Recently'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut color="#EF4444" size={20} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBg: { paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 40 },
  headerContent: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  riderName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  riderEmail: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  content: { padding: 20 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoTextGroup: { marginLeft: 16, flex: 1 },
  infoLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 16, borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { ChevronLeft, AlertTriangle, CheckCircle, RefreshCcw } from 'lucide-react-native';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function DisputesScreen({ navigation }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We treat 'cancelled' orders as disputes that might need refunds
    const q = query(collection(db, 'orders'), where('status', '==', 'cancelled'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort by creation date desc
      list.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toDate() - a.createdAt.toDate();
      });
      setDisputes(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkRefunded = (orderId, amount) => {
    Alert.alert(
      "Confirm Refund",
      `Have you processed the ₹${amount} refund in your payment gateway for Order #${orderId.slice(-8).toUpperCase()}?`,
      [
        { text: "No, cancel", style: "cancel" },
        {
          text: "Yes, Mark Refunded",
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'orders', orderId), {
                refundStatus: 'issued'
              });
              Alert.alert("Success", "Refund status updated to issued.");
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Could not update refund status.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#DC2626" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Refunds & Disputes</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <AlertTriangle color="#DC2626" size={32} />
          </View>
          <Text style={styles.summaryAmount}>{disputes.length}</Text>
          <Text style={styles.summaryTitle}>Cancelled Orders</Text>
        </View>

        <Text style={styles.sectionTitle}>Action Required</Text>
        {disputes.map(dispute => {
          const isRefunded = dispute.refundStatus === 'issued';
          
          return (
            <View key={dispute.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.orderId}>#{dispute.id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.dateText}>
                    {dispute.createdAt ? dispute.createdAt.toDate().toLocaleDateString() : 'Unknown Date'}
                  </Text>
                </View>
                <Text style={styles.amount}>₹{dispute.totalAmount || 0}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.customerName}>Customer: {dispute.customerName || 'Unknown'}</Text>
                <Text style={styles.pharmacyName}>Pharmacy: {dispute.pharmacyName || 'Unknown'}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardFooter}>
                {isRefunded ? (
                  <View style={styles.refundedBadge}>
                    <CheckCircle color="#059669" size={16} style={{ marginRight: 4 }} />
                    <Text style={styles.refundedText}>Refund Issued</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => handleMarkRefunded(dispute.id, dispute.totalAmount)}
                  >
                    <RefreshCcw color="#FFFFFF" size={16} style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Mark as Refunded</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {disputes.length === 0 && (
          <Text style={styles.emptyText}>No cancelled orders or disputes found.</Text>
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
  body: { flex: 1, padding: 16 },
  summaryCard: { backgroundColor: '#DC2626', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 32, marginBottom: 12 },
  summaryAmount: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold', marginBottom: 4 },
  summaryTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardHeaderLeft: { flex: 1 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  dateText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#DC2626' },
  cardBody: { marginBottom: 12 },
  customerName: { fontSize: 14, color: '#475569', marginBottom: 4 },
  pharmacyName: { fontSize: 14, color: '#475569' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  refundedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  refundedText: { color: '#059669', fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 24, fontStyle: 'italic' }
});

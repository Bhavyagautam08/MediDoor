import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ChevronLeft, TrendingUp, Download } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db } from '../firebaseConfig';

export default function DashboardRevenueScreen({ navigation }) {
  const [revenue, setRevenue] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', '==', 'delivered'));
    const unsub = onSnapshot(q, (snapshot) => {
      let total = 0;
      const recent = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        total += (data.totalAmount || 0);
        recent.push({ id: doc.id, ...data });
      });
      // Sort by date desc
      recent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRevenue(total);
      setOrders(recent);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const exportToCSV = async () => {
    if (orders.length === 0) {
      Alert.alert("No Data", "There are no orders to export.");
      return;
    }
    try {
      // Create CSV Header
      let csvContent = "Order ID,Date,Total Amount,Status\n";
      // Add Rows
      orders.forEach(order => {
        const dateStr = new Date(order.createdAt).toLocaleDateString();
        csvContent += `${order.id},${dateStr},${order.totalAmount || 0},${order.status}\n`;
      });

      const fileUri = FileSystem.documentDirectory + "revenue_report.csv";
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Revenue Report'
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("Error", "Failed to export report.");
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>;
  }

  // Generate Chart Data for Last 7 Days
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateString: d.toLocaleDateString(),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      total: 0
    };
  });

  orders.forEach(order => {
    const orderDate = new Date(order.createdAt).toLocaleDateString();
    const day = last7Days.find(d => d.dateString === orderDate);
    if (day) {
      day.total += (order.totalAmount || 0);
    }
  });

  const chartData = {
    labels: last7Days.map(d => d.label),
    datasets: [{ data: last7Days.map(d => d.total) }]
  };
  
  // Prevent chart crashing if all data is 0
  if (chartData.datasets[0].data.every(val => val === 0)) {
    chartData.datasets[0].data[0] = 0.01;
  }

  const screenWidth = Dimensions.get("window").width;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Revenue Report</Text>
        <TouchableOpacity onPress={exportToCSV} style={styles.backBtn}>
          <Download color="#3B82F6" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <TrendingUp color="#10B981" size={32} />
          </View>
          <Text style={styles.summaryTitle}>Total Processed Revenue</Text>
          <Text style={styles.summaryAmount}>₹{revenue.toLocaleString()}</Text>
          <Text style={styles.summarySub}>From {orders.length} completed orders</Text>
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>7-Day Revenue Trend</Text>
          <LineChart
            data={chartData}
            width={screenWidth - 32} // padding 16 on each side
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "6", strokeWidth: "2", stroke: "#047857" }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </View>

        <Text style={styles.sectionTitle}>Recent Completed Orders</Text>
        {orders.slice(0, 50).map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderLeft}>
              <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
              <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderAmount}>₹{order.totalAmount}</Text>
            </View>
          </View>
        ))}
        {orders.length === 0 && <Text style={styles.emptyText}>No revenue generated yet.</Text>}
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
  summaryCard: { backgroundColor: '#10B981', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  iconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 32, marginBottom: 12 },
  summaryTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  summaryAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginBottom: 4 },
  summarySub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  chartContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 12, marginLeft: 4 },
  orderCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  orderLeft: { flex: 1 },
  orderId: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  orderDate: { fontSize: 13, color: '#64748B' },
  orderRight: { justifyContent: 'center' },
  orderAmount: { fontSize: 18, fontWeight: 'bold', color: '#10B981' },
  emptyText: { color: '#64748B', textAlign: 'center', marginTop: 24 }
});

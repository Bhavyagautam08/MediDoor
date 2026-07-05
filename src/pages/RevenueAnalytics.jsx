import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import { IndianRupee, PieChart as PieChartIcon } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const RevenueAnalytics = () => {
  const [stats, setStats] = useState({
    gross: 12400000, // mock fallback
    commission: 1200000,
    delivery: 450000,
    net: 10700000
  });

  useEffect(() => {
    // Listen to real-time orders from Firebase to aggregate revenue
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalGross = 0;
      let totalComm = 0;
      let totalDelivery = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'delivered' || data.status === 'completed') {
          totalGross += data.gross || 0;
          totalComm += data.comm || 0;
          totalDelivery += data.deliveryFee || 0;
        }
      });

      if (totalGross > 0) {
        setStats({
          gross: totalGross,
          commission: totalComm,
          delivery: totalDelivery,
          net: totalGross - totalComm
        });
      }
    }, (error) => {
      console.error("Error fetching revenue:", error);
    });

    return () => unsubscribe();
  }, []);

  // Format currency
  const formatCurrency = (val) => {
    if (val >= 1000000) return `₹${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Revenue Analytics</h1>

      <div className="grid-cards">
        <StatCard title="Total Gross Revenue" value={formatCurrency(stats.gross)} icon={IndianRupee} color="#4CAF50" />
        <StatCard title="Commission Earned" value={formatCurrency(stats.commission)} icon={PieChartIcon} color="#2196F3" />
        <StatCard title="Delivery Charges" value={formatCurrency(stats.delivery)} icon={IndianRupee} color="#FF9800" />
        <StatCard title="Net Payouts" value={formatCurrency(stats.net)} icon={IndianRupee} color="#9C27B0" />
      </div>

      <div className="dashboard-charts">
        <div className="chart-card card">
          <h3>Daily Revenue (Last 30 Days)</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            [Line Chart Placeholder]
          </div>
        </div>
        <div className="chart-card card">
          <h3>Revenue Sources</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            [Pie Chart Placeholder]
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalytics;

import React from 'react';
import StatCard from '../components/StatCard';
import { Users, HeartPulse, Truck, Receipt, Calendar, DollarSign, Percent, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const mockOrders = [
  { id: 'ORD-1001', customer: 'Rahul Sharma', pharmacy: 'Apollo Pharmacy', amount: 450, status: 'delivered', date: '2023-10-24' },
  { id: 'ORD-1002', customer: 'Priya Singh', pharmacy: 'Wellness Plus', amount: 1200, status: 'out_for_delivery', date: '2023-10-24' },
  { id: 'ORD-1003', customer: 'Amit Kumar', pharmacy: 'City Meds', amount: 320, status: 'preparing', date: '2023-10-24' },
  { id: 'ORD-1004', customer: 'Neha Gupta', pharmacy: 'Apollo Pharmacy', amount: 850, status: 'order_placed', date: '2023-10-24' },
  { id: 'ORD-1005', customer: 'Vikram Patel', pharmacy: 'MedPlus', amount: 2100, status: 'cancelled', date: '2023-10-23' },
];

const chartData = [
  { name: 'Mon', orders: 40, revenue: 2400 },
  { name: 'Tue', orders: 30, revenue: 1398 },
  { name: 'Wed', orders: 20, revenue: 9800 },
  { name: 'Thu', orders: 27, revenue: 3908 },
  { name: 'Fri', orders: 18, revenue: 4800 },
  { name: 'Sat', orders: 23, revenue: 3800 },
  { name: 'Sun', orders: 34, revenue: 4300 },
];

const Dashboard = () => {
  const navigate = useNavigate();

  const getStatusBadge = (status) => {
    switch(status) {
      case 'delivered': return <span className="badge success">Delivered</span>;
      case 'out_for_delivery': return <span className="badge info">Out for Delivery</span>;
      case 'preparing': return <span className="badge warning">Preparing</span>;
      case 'order_placed': return <span className="badge">Placed</span>;
      case 'cancelled': return <span className="badge danger">Cancelled</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="dashboard-page">
      <h1 className="page-title">Dashboard Overview</h1>

      <div className="grid-cards">
        <StatCard title="Total Customers" value="4,209" icon={Users} color="#1565C0" />
        <StatCard title="Total Pharmacies" value="124" icon={HeartPulse} color="#00C853" />
        <StatCard title="Delivery Partners" value="89" icon={Truck} color="#FF9800" />
        <StatCard title="Total Orders" value="12,450" icon={Receipt} color="#9C27B0" />
      </div>

      <div className="grid-cards">
        <StatCard title="Today's Orders" value="145" icon={Calendar} color="#2196F3" />
        <StatCard title="Total Gross Revenue" value="₹1.2M" icon={DollarSign} color="#4CAF50" />
        <StatCard title="Total Commission" value="₹185K" icon={Percent} color="#F44336" />
      </div>

      <div className="dashboard-charts">
        <div className="chart-card card">
          <h3>Orders (Last 7 Days)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card card">
          <h3>Revenue Overview</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="recent-orders card">
        <div className="section-header">
          <h3>Recent Orders</h3>
          <button className="btn btn-secondary" onClick={() => navigate('/orders')}>
            View All <ArrowRight size={16} />
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Pharmacy</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map(order => (
                <tr key={order.id}>
                  <td><strong>{order.id}</strong></td>
                  <td>{order.customer}</td>
                  <td>{order.pharmacy}</td>
                  <td>₹{order.amount}</td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td>{order.date}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => navigate('/orders')}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

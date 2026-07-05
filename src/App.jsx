import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import CustomerManagement from './pages/CustomerManagement';
import PharmacyManagement from './pages/PharmacyManagement';
import DeliveryPartnerManagement from './pages/DeliveryPartnerManagement';
import OrderManagement from './pages/OrderManagement';
import CommissionManagement from './pages/CommissionManagement';
import RevenueAnalytics from './pages/RevenueAnalytics';
import BusinessSettings from './pages/BusinessSettings';
import PushNotifications from './pages/PushNotifications';
import Reports from './pages/Reports';

// Mock Auth check
const useAuth = () => {
  return { isAuthenticated: true, role: 'admin' };
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated || role !== 'admin') {
    return <Navigate to="/" />;
  }
  return children;
};

const AppLayout = ({ children }) => {
  return (
    <div className="app-container">
      <AdminSidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        
        {/* Protected Admin Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><AppLayout><CustomerManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/pharmacies" element={<ProtectedRoute><AppLayout><PharmacyManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/delivery-partners" element={<ProtectedRoute><AppLayout><DeliveryPartnerManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><AppLayout><OrderManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/commission" element={<ProtectedRoute><AppLayout><CommissionManagement /></AppLayout></ProtectedRoute>} />
        <Route path="/revenue" element={<ProtectedRoute><AppLayout><RevenueAnalytics /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout><BusinessSettings /></AppLayout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><AppLayout><PushNotifications /></AppLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;

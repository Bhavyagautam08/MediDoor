import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, HeartPulse, Truck, 
  Receipt, Percent, BarChart3, Settings, 
  Bell, FileText, LogOut 
} from 'lucide-react';
import './AdminSidebar.css';

const AdminSidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Implement actual firebase logout here
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Pharmacies', path: '/pharmacies', icon: HeartPulse },
    { name: 'Delivery Partners', path: '/delivery-partners', icon: Truck },
    { name: 'Orders', path: '/orders', icon: Receipt },
    { name: 'Commission', path: '/commission', icon: Percent },
    { name: 'Revenue', path: '/revenue', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Reports', path: '/reports', icon: FileText },
  ];

  return (
    <div className="admin-sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/logo.png" alt="MediDoor Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
        </div>
        <h2>MediDoor Admin</h2>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon className="nav-icon" size={20} />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;

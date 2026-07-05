import React, { useState } from 'react';
import { Star } from 'lucide-react';

const mockPartners = [
  { id: 'DP-1', name: 'Raju Bhai', phone: '9876543301', vehicle: 'Bike (Hero Honda)', city: 'Mumbai', rating: 4.8, deliveries: 1240, status: 'Approved' },
  { id: 'DP-2', name: 'Vikram Singh', phone: '9876543302', vehicle: 'Scooter (Activa)', city: 'Delhi', rating: 4.2, deliveries: 320, status: 'Pending' },
];

const DeliveryPartnerManagement = () => {
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['Pending', 'Approved', 'Rejected', 'All'];

  return (
    <div className="page-container">
      <h1 className="page-title">Delivery Partner Management</h1>

      <div className="card">
        <div className="tabs">
          {tabs.map(tab => (
            <button 
              key={tab} 
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Vehicle</th>
                <th>Rating</th>
                <th>Deliveries</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPartners.map(partner => (
                <tr key={partner.id}>
                  <td><strong>{partner.name}</strong></td>
                  <td>{partner.phone}<br/><small style={{ color: 'var(--text-muted)' }}>{partner.city}</small></td>
                  <td>{partner.vehicle}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#FF9800', fontWeight: 'bold' }}>
                      <Star size={16} fill="#FF9800" /> {partner.rating}
                    </div>
                  </td>
                  <td>{partner.deliveries}</td>
                  <td>
                    <span className={`badge ${partner.status === 'Approved' ? 'success' : 'warning'}`}>
                      {partner.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Docs</button>
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

export default DeliveryPartnerManagement;

import React, { useState } from 'react';
import { Search, CheckCircle, XCircle } from 'lucide-react';

const mockPharmacies = [
  { id: 'PHARM-1', name: 'Apollo Pharmacy', owner: 'Ramesh Gupta', phone: '9876543220', city: 'Mumbai', commission: 10, status: 'Approved' },
  { id: 'PHARM-2', name: 'Wellness Plus', owner: 'Suresh Kumar', phone: '9876543221', city: 'Delhi', commission: 0, status: 'Pending' },
  { id: 'PHARM-3', name: 'City Meds', owner: 'Anita Sharma', phone: '9876543222', city: 'Bangalore', commission: 12, status: 'Rejected' },
];

const PharmacyManagement = () => {
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['Pending', 'Approved', 'Rejected', 'All'];

  return (
    <div className="page-container">
      <h1 className="page-title">Pharmacy Management</h1>

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
                <th>Shop Name</th>
                <th>Owner</th>
                <th>City</th>
                <th>Commission</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPharmacies.map(pharmacy => (
                <tr key={pharmacy.id}>
                  <td><strong>{pharmacy.name}</strong></td>
                  <td>{pharmacy.owner}<br/><small style={{ color: 'var(--text-muted)' }}>{pharmacy.phone}</small></td>
                  <td>{pharmacy.city}</td>
                  <td>{pharmacy.commission > 0 ? `${pharmacy.commission}% (Custom)` : 'Global (10%)'}</td>
                  <td>
                    <span className={`badge ${pharmacy.status === 'Approved' ? 'success' : pharmacy.status === 'Pending' ? 'warning' : 'danger'}`}>
                      {pharmacy.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>View</button>
                      {pharmacy.status === 'Pending' && (
                        <>
                          <button className="btn" style={{ padding: '0.25rem 0.5rem', background: '#e8f5e9', color: 'var(--success)' }}><CheckCircle size={16}/></button>
                          <button className="btn" style={{ padding: '0.25rem 0.5rem', background: '#ffebee', color: 'var(--danger)' }}><XCircle size={16}/></button>
                        </>
                      )}
                    </div>
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

export default PharmacyManagement;

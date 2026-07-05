import React, { useState } from 'react';
import { Search, MoreVertical, Edit, Trash2, ShieldBan } from 'lucide-react';

const mockCustomers = [
  { id: 'CUST-001', name: 'Rahul Sharma', phone: '+91 9876543210', email: 'rahul@example.com', joinDate: '2023-01-15', totalOrders: 12, status: 'Active' },
  { id: 'CUST-002', name: 'Priya Singh', phone: '+91 9876543211', email: 'priya@example.com', joinDate: '2023-02-20', totalOrders: 5, status: 'Active' },
  { id: 'CUST-003', name: 'Amit Kumar', phone: '+91 9876543212', email: 'amit@example.com', joinDate: '2023-03-10', totalOrders: 28, status: 'Blocked' },
  { id: 'CUST-004', name: 'Neha Gupta', phone: '+91 9876543213', email: 'neha@example.com', joinDate: '2023-04-05', totalOrders: 2, status: 'Active' },
];

const CustomerManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="page-container">
      <h1 className="page-title">Customer Management</h1>
      
      <div className="card">
        <div className="section-header">
          <div className="input-group" style={{ marginBottom: 0, width: '300px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by name or phone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.5rem' }}
              />
              <Search size={20} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Join Date</th>
                <th>Total Orders</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockCustomers.map(customer => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone}</td>
                  <td>{customer.email}</td>
                  <td>{customer.joinDate}</td>
                  <td>{customer.totalOrders}</td>
                  <td>
                    <span className={`badge ${customer.status === 'Active' ? 'success' : 'danger'}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>View</button>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem', background: '#ffebee', color: 'var(--danger)' }}>
                        <ShieldBan size={16} />
                      </button>
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

export default CustomerManagement;

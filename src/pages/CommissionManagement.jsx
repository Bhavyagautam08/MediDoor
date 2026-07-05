import React, { useState } from 'react';
import StatCard from '../components/StatCard';
import { DollarSign, Percent, TrendingUp, Calendar } from 'lucide-react';

const CommissionManagement = () => {
  const [globalCommission, setGlobalCommission] = useState(10);

  return (
    <div className="page-container">
      <h1 className="page-title">Commission Management</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Global Commission Setting</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>This applies to all pharmacies unless a custom % is set per pharmacy.</p>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                className="input-field" 
                value={globalCommission}
                onChange={(e) => setGlobalCommission(e.target.value)}
                style={{ width: '120px' }}
              />
              <span style={{ position: 'absolute', right: '1rem', top: '0.75rem' }}>%</span>
            </div>
          </div>
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>

      <div className="grid-cards">
        <StatCard title="Total Earned (All Time)" value="₹2.4M" icon={TrendingUp} color="#00C853" />
        <StatCard title="Commission Today" value="₹12.5K" icon={DollarSign} color="#2196F3" />
        <StatCard title="This Week" value="₹85.4K" icon={Calendar} color="#9C27B0" />
        <StatCard title="This Month" value="₹340.2K" icon={Percent} color="#FF9800" />
      </div>

      <div className="card">
        <div className="section-header">
          <h3>Per Pharmacy Commission</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Pharmacy Name</th>
                <th>Commission %</th>
                <th>Total Orders</th>
                <th>Gross Value</th>
                <th>Comm. Earned</th>
                <th>Net to Pharmacy</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Apollo Pharmacy</strong></td>
                <td>10%</td>
                <td>1,420</td>
                <td>₹1,450,000</td>
                <td>₹145,000</td>
                <td>₹1,305,000</td>
                <td><button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Edit %</button></td>
              </tr>
              <tr>
                <td><strong>Wellness Plus</strong></td>
                <td>12%</td>
                <td>840</td>
                <td>₹920,000</td>
                <td>₹110,400</td>
                <td>₹809,600</td>
                <td><button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Edit %</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CommissionManagement;

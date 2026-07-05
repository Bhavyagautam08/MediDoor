import React from 'react';
import { Download } from 'lucide-react';

const Reports = () => {
  return (
    <div className="page-container">
      <h1 className="page-title">Reports</h1>

      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>Generate Report</h3>
        
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div className="input-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Report Type</label>
            <select className="input-field">
              <option>Order Report</option>
              <option>Commission Report</option>
              <option>Customer Growth Report</option>
              <option>Pharmacy Performance Report</option>
              <option>Delivery Partner Performance Report</option>
              <option>Revenue Report</option>
            </select>
          </div>
          
          <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>Start Date</label>
            <input type="date" className="input-field" />
          </div>
          
          <div className="input-group" style={{ flex: '1', minWidth: '150px' }}>
            <label>End Date</label>
            <input type="date" className="input-field" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary">Generate Report</button>
          <button className="btn btn-secondary"><Download size={18} /> Export CSV</button>
        </div>

        <div style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          Select parameters and click "Generate Report" to view data.
        </div>
      </div>
    </div>
  );
};

export default Reports;

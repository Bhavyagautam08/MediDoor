import React from 'react';

const BusinessSettings = () => {
  return (
    <div className="page-container">
      <h1 className="page-title">Business Settings</h1>

      <div className="dashboard-charts">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Delivery Charges</h3>
          <div className="input-group">
            <label>Base Delivery Fee (₹)</label>
            <input type="number" className="input-field" defaultValue={40} />
          </div>
          <div className="input-group">
            <label>Express Delivery Surcharge (₹)</label>
            <input type="number" className="input-field" defaultValue={20} />
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Delivery Settings</button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Service Areas</h3>
          <div className="input-group">
            <label>Add City / Pin Code</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input-field" placeholder="e.g., Mumbai or 400001" style={{ flex: 1 }} />
              <button className="btn btn-secondary">Add</button>
            </div>
          </div>
          
          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="badge info">Mumbai <button style={{ background: 'none', border: 'none', marginLeft: '4px', cursor: 'pointer' }}>×</button></span>
            <span className="badge info">Delhi <button style={{ background: 'none', border: 'none', marginLeft: '4px', cursor: 'pointer' }}>×</button></span>
            <span className="badge info">Bangalore <button style={{ background: 'none', border: 'none', marginLeft: '4px', cursor: 'pointer' }}>×</button></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSettings;

import React from 'react';

const PushNotifications = () => {
  return (
    <div className="page-container">
      <h1 className="page-title">Push Notifications</h1>

      <div className="dashboard-charts">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Send New Notification</h3>
          <div className="input-group">
            <label>Target Audience</label>
            <select className="input-field">
              <option>All Users</option>
              <option>All Customers</option>
              <option>All Pharmacies</option>
              <option>All Delivery Partners</option>
              <option>Specific User</option>
            </select>
          </div>
          <div className="input-group">
            <label>Notification Title</label>
            <input type="text" className="input-field" placeholder="e.g., Special Offer!" />
          </div>
          <div className="input-group">
            <label>Notification Message</label>
            <textarea className="input-field" rows="4" placeholder="Enter message here..."></textarea>
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>Send Notification</button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Recent Notifications</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Target</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Weekend Discount!</strong><br/><small>Get 20% off on all medicines.</small></td>
                  <td>All Customers</td>
                  <td>Oct 24, 2023</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotifications;

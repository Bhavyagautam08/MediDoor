import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Search, X, CheckCircle, Package, Truck, User, CreditCard, ShieldCheck } from 'lucide-react';
import './OrderManagement.css'; // Assume there is some basic styling, we'll augment with inline

const OrderManagement = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState({ customer: null, pharmacy: null, rider: null });
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = ['All', 'Accepted', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Cancelled'];

  useEffect(() => {
    // Listen to real-time orders from Firebase
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getDisplayId = (order) => {
    return order.numericId || order.id.slice(-6).toUpperCase();
  };

  const fetchOrderDetails = async (order) => {
    setSelectedOrder(order);
    setIsFetchingDetails(true);
    setOrderDetails({ customer: null, pharmacy: null, rider: null });

    try {
      const details = {};
      
      if (order.userId) {
        const custSnap = await getDoc(doc(db, 'customers', order.userId));
        if (custSnap.exists()) details.customer = custSnap.data();
      }
      if (order.pharmacyId) {
        const pharmSnap = await getDoc(doc(db, 'pharmacies', order.pharmacyId));
        if (pharmSnap.exists()) details.pharmacy = pharmSnap.data();
      }
      if (order.riderId) {
        const riderSnap = await getDoc(doc(db, 'delivery_agents', order.riderId));
        if (riderSnap.exists()) details.rider = riderSnap.data();
      }
      
      setOrderDetails(details);
    } catch (err) {
      console.error("Error fetching details:", err);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("Are you absolutely sure you want to cancel this order? This action cannot be undone and will notify all parties.")) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'Cancelled',
          cancelledAt: Date.now()
        });
        setSelectedOrder(prev => prev ? { ...prev, status: 'Cancelled' } : null);
        alert("Order successfully cancelled.");
      } catch (err) {
        console.error("Error cancelling order:", err);
        alert("Failed to cancel order.");
      }
    }
  };

  const getStatusBadgeColor = (status) => {
    if (!status) return '#6B7280';
    const s = status.toLowerCase();
    if (s.includes('deliver')) return '#10B981';
    if (s.includes('out for')) return '#3B82F6';
    if (s.includes('cancel')) return '#EF4444';
    if (s.includes('ready')) return '#8B5CF6';
    return '#F59E0B';
  };

  const filteredOrders = orders.filter(o => {
    const matchesTab = activeTab === 'All' || o.status === activeTab;
    const searchLower = searchTerm.toLowerCase();
    const orderId = getDisplayId(o).toLowerCase();
    const matchesSearch = orderId.includes(searchLower) || (o.address && o.address.toLowerCase().includes(searchLower));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="page-container" style={{ padding: '24px', backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Order Management</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', width: '300px' }}>
          <Search size={18} color="#9CA3AF" />
          <input 
            type="text" 
            placeholder="Search by Order ID or Address..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '14px' }}
          />
        </div>
      </div>

      <div className="card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div className="tabs" style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', padding: '0 16px' }}>
          {tabs.map(tab => (
            <button 
              key={tab} 
              style={{
                padding: '16px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                borderBottom: activeTab === tab ? '3px solid #10B981' : '3px solid transparent',
                color: activeTab === tab ? '#10B981' : '#6B7280',
                fontWeight: activeTab === tab ? 'bold' : '500',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="table-container" style={{ padding: '0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>Loading real-time orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>No orders found for this category.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#F3F4F6' }}>
                <tr>
                  <th style={thStyle}>Order ID</th>
                  <th style={thStyle}>Date & Time</th>
                  <th style={thStyle}>Total Value</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={tdStyle}><strong>#{getDisplayId(order)}</strong></td>
                    <td style={tdStyle}>
                      {new Date(order.createdAt).toLocaleDateString()} <br/>
                      <small style={{ color: '#6B7280' }}>{new Date(order.createdAt).toLocaleTimeString()}</small>
                    </td>
                    <td style={tdStyle}>₹{Number(order.totalAmount || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: order.paymentMethod === 'online' ? '#DBEAFE' : '#ECFDF5', color: order.paymentMethod === 'online' ? '#1D4ED8' : '#047857', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {order.paymentMethod || 'COD'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: `${getStatusBadgeColor(order.status)}20`, color: getStatusBadgeColor(order.status), fontSize: '12px', fontWeight: 'bold' }}>
                        {order.status || 'Placed'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button 
                        style={{ padding: '6px 16px', backgroundColor: '#10B981', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => fetchOrderDetails(order)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* order Details Modal */}
      {selectedOrder && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #E5E7EB' }}>
              <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Order #{getDisplayId(selectedOrder)}
                <span style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: `${getStatusBadgeColor(selectedOrder.status)}20`, color: getStatusBadgeColor(selectedOrder.status), fontSize: '12px', fontWeight: 'bold' }}>
                  {selectedOrder.status}
                </span>
              </h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#6B7280" /></button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '70vh' }}>
              {isFetchingDetails ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>Fetching comprehensive order details...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  
                  {/* Left Column: Stakeholders */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}><User size={18}/> Customer Details</h3>
                      <p><strong>Name:</strong> {orderDetails.customer?.name || 'Unknown'}</p>
                      <p><strong>Phone:</strong> {orderDetails.customer?.phone || 'Unknown'}</p>
                      <p><strong>Delivery Address:</strong><br/>{selectedOrder.address || 'No address provided'}</p>
                    </div>

                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}><Package size={18}/> Pharmacy Details</h3>
                      {orderDetails.pharmacy ? (
                        <>
                          <p><strong>Name:</strong> {orderDetails.pharmacy.name}</p>
                          <p><strong>Contact:</strong> {orderDetails.pharmacy.phone || 'N/A'}</p>
                          <p><strong>Address:</strong><br/>{orderDetails.pharmacy.address || 'N/A'}</p>
                        </>
                      ) : (
                        <p style={{ color: '#EF4444' }}>Pharmacy not assigned or found.</p>
                      )}
                    </div>

                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}><Truck size={18}/> Delivery Partner</h3>
                      {orderDetails.rider ? (
                        <>
                          <p><strong>Name:</strong> {orderDetails.rider.name}</p>
                          <p><strong>Phone:</strong> {orderDetails.rider.phone || 'N/A'}</p>
                          <p><strong>Vehicle:</strong> {orderDetails.rider.vehicleModel || 'N/A'} ({orderDetails.rider.vehicleNumber || 'N/A'})</p>
                        </>
                      ) : (
                        <p style={{ color: '#6B7280' }}>Waiting for rider assignment...</p>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Billing & Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}><ShieldCheck size={18}/> Secure PINs (Auth Override)</h3>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#047857', fontWeight: 'bold' }}>PICKUP PIN</p>
                          <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '900', letterSpacing: '4px', color: '#065F46' }}>
                            {selectedOrder.pickupOtp || getDisplayId(selectedOrder).slice(-4)}
                          </p>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: '#047857', fontWeight: 'bold' }}>DROPOFF PIN</p>
                          <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '900', letterSpacing: '4px', color: '#065F46' }}>
                            {selectedOrder.dropoffOtp || getDisplayId(selectedOrder).slice(-4)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}><CreditCard size={18}/> Financial Breakdown</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#4B5563' }}>Subtotal (Medicines)</span>
                        <span style={{ fontWeight: '500' }}>₹{Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#4B5563' }}>Delivery Fee</span>
                        <span style={{ fontWeight: '500' }}>₹{Number(selectedOrder.deliveryFee || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: '#4B5563' }}>Taxes & GST</span>
                        <span style={{ fontWeight: '500' }}>₹{Number(selectedOrder.taxes || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Total Customer Paid</span>
                        <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#10B981' }}>₹{Number(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ marginTop: '16px', fontSize: '12px', color: '#6B7280', textAlign: 'right' }}>
                        Method: <strong style={{ textTransform: 'uppercase' }}>{selectedOrder.paymentMethod || 'COD'}</strong>
                      </div>
                    </div>
                    
                    <div style={detailBoxStyle}>
                      <h3 style={boxTitleStyle}>Order Items ({selectedOrder.items?.length || 0})</h3>
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        <ul style={{ paddingLeft: '20px', margin: 0, color: '#374151' }}>
                          {selectedOrder.items.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '8px' }}>
                              <strong>{item.qty}x</strong> {item.name || 'Prescription Items'} - ₹{(item.price * item.qty).toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: '#6B7280', margin: 0 }}>No items details available.</p>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#F9FAFB', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              {selectedOrder.status !== 'Cancelled' && selectedOrder.status !== 'Delivered' && (
                <button 
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                  style={{ padding: '10px 20px', backgroundColor: '#EF4444', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <X size={18} /> Force Cancel Order
                </button>
              )}
              <button 
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '10px 24px', backgroundColor: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline Styles for complex components
const thStyle = { textAlign: 'left', padding: '16px', color: '#6B7280', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '16px', color: '#111827', fontSize: '14px', verticalAlign: 'middle' };

const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
};
const modalContentStyle = {
  backgroundColor: '#FFFFFF', width: '900px', maxWidth: '95vw', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column'
};
const detailBoxStyle = {
  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px'
};
const boxTitleStyle = {
  fontSize: '16px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F3F4F6', paddingBottom: '12px'
};

export default OrderManagement;

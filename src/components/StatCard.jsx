import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon: Icon, color = 'var(--secondary)' }) => {
  return (
    <div className="stat-card card">
      <div className="stat-info">
        <h3 className="stat-title">{title}</h3>
        <p className="stat-value">{value}</p>
      </div>
      <div className="stat-icon" style={{ backgroundColor: `${color}15`, color: color }}>
        <Icon size={24} />
      </div>
    </div>
  );
};

export default StatCard;

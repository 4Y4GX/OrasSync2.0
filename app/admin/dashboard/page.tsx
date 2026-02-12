'use client';

import { useState } from 'react';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import AdminUserManagement from '../../components/AdminUserManagement'; 
import ExcelImportExport from '../../components/ExcelImportExport';
import AnalyticsView from '../../components/AnalyticsView'; // New Component

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('users');
  const [lightMode, setLightMode] = useState(false);

  return (
    <div className={`dashboard-container admin-theme ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>
      
      <aside className="info-panel">
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="brand-logo">ORASync</div>

        <ul className="nav-links">
          {/* UPDATED: Replaced 'settings' with 'analytics' */}
          {['users', 'import-export', 'departments', 'system', 'analytics'].map(section => (
            <li 
              key={section}
              className={`nav-item ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              {section === 'import-export' ? 'Import/Export' : section.charAt(0).toUpperCase() + section.slice(1)}
            </li>
          ))}
        </ul>

        <div className="widget-box">
          <div className="label-sm">System Status</div>
          <div className="status-badge go">
            <span className="dot"></span>
            OPERATIONAL
          </div>
        </div>

        <div className="profile-card">
          <div className="streak-badge">🔐 ADMIN</div>
          <div className="avatar">AD</div>
          <div className="profile-info">
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Admin User</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SYSTEM ADMIN</div>
          </div>
        </div>
      </aside>

      <main className="workspace-panel">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {activeSection === 'analytics' ? 'System Analytics' : 'Admin Dashboard'}
          </h1>
          <button 
            className="theme-btn" 
            onClick={() => setLightMode(!lightMode)}
            aria-label="Toggle theme"
          >
            {lightMode ? '☾' : '☀'}
          </button>
        </div>

        <div className="content-area">
          {activeSection === 'users' && (
            <div className="section-view active fade-in">
              <AdminUserManagement />
            </div>
          )}

          {activeSection === 'import-export' && (
            <div className="section-view active fade-in">
              <ExcelImportExport />
            </div>
          )}

          {activeSection === 'analytics' && (
            <div className="section-view active fade-in">
              <AnalyticsView />
            </div>
          )}

          {/* Placeholders */}
          {['departments', 'system'].includes(activeSection) && (
            <div className="section-view active fade-in">
               <div className="glass-card">
                 <div className="section-title">{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</div>
                 <p style={{color: 'var(--text-muted)'}}>Module loading...</p>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
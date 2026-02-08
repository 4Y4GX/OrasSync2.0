'use client';

import { useState } from 'react';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import AdminUserManagement from '@/app/components/AdminUserManagement';
import ExcelImportExport from '@/app/components/ExcelImportExport';

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
          {['users', 'import-export', 'departments', 'audit', 'system', 'settings'].map(section => (
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Admin Dashboard</h1>
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

          {activeSection === 'departments' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">Department Management</div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Department management features coming soon. Use User Management to assign users to departments.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'audit' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">Audit Log</div>
                <div className="table-container" style={{ maxHeight: '600px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Table</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 50 }).map((_, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            2024-02-06 {String(Math.floor(Math.random() * 24)).padStart(2, '0')}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00
                          </td>
                          <td>admin</td>
                          <td><span className="action-badge">UPDATE</span></td>
                          <td>D_tbluser</td>
                          <td>Modified user status</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'system' && (
            <div className="section-view active fade-in">
              <div className="stats-row">
                <div className="stat-box">
                  <div className="label-sm">Database Size</div>
                  <div className="stat-big admin-accent">2.4 GB</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">API Calls (24h)</div>
                  <div className="stat-big admin-accent">45.2K</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">System Uptime</div>
                  <div className="stat-big" style={{ color: 'var(--color-go)' }}>99.9%</div>
                </div>
              </div>

              <div className="glass-card">
                <div className="section-title">System Configuration</div>
                <div className="config-grid">
                  <div className="config-item">
                    <span className="config-label">Session Timeout</span>
                    <input type="text" className="input-rounded" defaultValue="8 hours" />
                  </div>
                  <div className="config-item">
                    <span className="config-label">Max Failed Logins</span>
                    <input type="number" className="input-rounded" defaultValue="3" />
                  </div>
                  <div className="config-item">
                    <span className="config-label">Data Retention (days)</span>
                    <input type="number" className="input-rounded" defaultValue="365" />
                  </div>
                </div>
                <button className="btn-action btn-standard" style={{ marginTop: '20px' }}>
                  Save Configuration
                </button>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">Admin Settings</div>
                <div className="settings-row">
                  <span>Maintenance Mode</span>
                  <label className="toggle-switch">
                    <input type="checkbox" />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="settings-row">
                  <span>Audit Logging</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="settings-row">
                  <span>Two-Factor Authentication</span>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

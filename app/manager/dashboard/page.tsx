'use client';

import { useState } from 'react';
import '../../styles/dashboard.css';
import '../../styles/manager.css';

export default function ManagerDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [lightMode, setLightMode] = useState(false);

  return (
    <div className={`dashboard-container manager-theme ${lightMode ? 'light-mode' : ''}`}>
      <div className="tech-mesh"></div>
      
      <aside className="info-panel">
        <div className="bg-decor bg-sq-outline sq-top-left"></div>
        <div className="brand-logo">ORASync</div>

        <ul className="nav-links">
          {['overview', 'departments', 'approvals', 'analytics', 'reports', 'settings'].map(section => (
            <li 
              key={section}
              className={`nav-item ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </li>
          ))}
        </ul>

        <div className="widget-box">
          <div className="label-sm">Final Approvals</div>
          <div className="status-badge warn">
            <span className="dot"></span>
            15 PENDING
          </div>
        </div>

        <div className="profile-card">
          <div className="streak-badge">⭐ MANAGER</div>
          <div className="avatar">RM</div>
          <div className="profile-info">
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Robert Manager</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MANAGER</div>
          </div>
        </div>
      </aside>

      <main className="workspace-panel">
        <div className="top-bar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Manager Dashboard</h1>
          <button 
            className="theme-btn" 
            onClick={() => setLightMode(!lightMode)}
            aria-label="Toggle theme"
          >
            {lightMode ? '☾' : '☀'}
          </button>
        </div>

        <div className="content-area">
          {activeSection === 'overview' && (
            <div className="section-view active fade-in">
              <div className="hud-row">
                <div className="hud-card">
                  <div className="hud-label">Total Employees</div>
                  <div className="hud-val manager-accent">48</div>
                  <div className="hud-bg-icon">👥</div>
                </div>
                <div className="hud-card">
                  <div className="hud-label">Departments</div>
                  <div className="hud-val manager-accent">4</div>
                  <div className="hud-bg-icon">📊</div>
                </div>
                <div className="hud-card">
                  <div className="hud-label">Pending Approvals</div>
                  <div className="hud-val" style={{ color: 'var(--color-warn)' }}>15</div>
                  <div className="hud-bg-icon">⏳</div>
                </div>
              </div>

              <div className="glass-card">
                <div className="section-title">Department Overview</div>
                <div className="department-grid">
                  {[
                    { name: 'Development', employees: 18, hours: 720, productivity: 96 },
                    { name: 'QA Testing', employees: 12, hours: 480, productivity: 94 },
                    { name: 'Design', employees: 8, hours: 320, productivity: 92 },
                    { name: 'Operations', employees: 10, hours: 400, productivity: 98 }
                  ].map((dept, i) => (
                    <div key={i} className="dept-card">
                      <h3>{dept.name}</h3>
                      <div className="dept-stats">
                        <div>
                          <span className="dept-label">Employees</span>
                          <span className="dept-value">{dept.employees}</span>
                        </div>
                        <div>
                          <span className="dept-label">Hours (Week)</span>
                          <span className="dept-value">{dept.hours}</span>
                        </div>
                        <div>
                          <span className="dept-label">Productivity</span>
                          <span className="dept-value" style={{ color: 'var(--color-go)' }}>{dept.productivity}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'approvals' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">
                  <span>Final Timesheet Approvals</span>
                  <span style={{ color: 'var(--color-warn)' }}>15 Waiting</span>
                </div>
                <div className="table-container" style={{ maxHeight: '600px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Date</th>
                        <th>Hours</th>
                        <th>Supervisor</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>Employee {i + 1}</td>
                          <td>Development</td>
                          <td>2024-02-05</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>8.0</td>
                          <td>Sarah Manager</td>
                          <td><span className="badge-warning">Pending</span></td>
                          <td>
                            <button className="btn-mini manager-btn">Review</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'analytics' && (
            <div className="section-view active fade-in">
              <div className="stats-row">
                <div className="stat-box">
                  <div className="label-sm">Total Hours (Month)</div>
                  <div className="stat-big manager-accent">7,680</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">Avg Productivity</div>
                  <div className="stat-big" style={{ color: 'var(--color-go)' }}>95%</div>
                </div>
                <div className="stat-box">
                  <div className="label-sm">Cost Savings</div>
                  <div className="stat-big manager-accent">$12K</div>
                </div>
              </div>

              <div className="glass-card">
                <div className="section-title">Department Performance Comparison</div>
                <div className="graph-container">
                  {['Dev', 'QA', 'Design', 'Ops'].map((dept, i) => (
                    <div key={dept} className="bar-group">
                      <div className="bar bar-actual manager-bar" style={{ height: `${60 + i * 10}%` }}></div>
                      <div className="bar-label">{dept}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="section-view active fade-in">
              <div className="glass-card">
                <div className="section-title">Manager Settings</div>
                <div className="settings-row">
                  <span>Auto-Approve Verified Hours</span>
                  <label className="toggle-switch">
                    <input type="checkbox" />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="settings-row">
                  <span>Email Digest</span>
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
